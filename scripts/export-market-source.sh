#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "[market-source] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

for required_name in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
  if [[ -z "${!required_name:-}" ]]; then
    echo "[market-source] ERROR: missing ${required_name}" >&2
    exit 1
  fi
done

if ! command -v mysql >/dev/null 2>&1; then
  echo "[market-source] ERROR: mysql is unavailable" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[market-source] ERROR: psql is unavailable" >&2
  exit 1
fi

SCHEMA_SQL="${ROOT_DIR}/scripts/sql/market-source-schema.sql"
if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/market-source.XXXXXX")"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

mysql_exec() {
  MYSQL_PWD="${DB_PASSWORD}" mysql \
    -h "${DB_HOST}" \
    -P "${DB_PORT}" \
    -u "${DB_USER}" \
    -N \
    -B \
    "${DB_NAME}" \
    -e "${1}"
}

build_json_query() {
  local table_name="${1}"

  mysql_exec "
    SET SESSION group_concat_max_len = 1000000;
    SELECT CONCAT(
      'SELECT JSON_OBJECT(',
      GROUP_CONCAT(
        CONCAT(
          QUOTE(COLUMN_NAME),
          ', ',
          CHAR(96),
          REPLACE(COLUMN_NAME, CHAR(96), CONCAT(CHAR(96), CHAR(96))),
          CHAR(96)
        )
        ORDER BY ORDINAL_POSITION
        SEPARATOR ', '
      ),
      ') FROM ',
      CHAR(96),
      '${DB_NAME}',
      CHAR(96),
      '.',
      CHAR(96),
      '${table_name}',
      CHAR(96)
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = '${DB_NAME}'
      AND TABLE_NAME = '${table_name}'
    GROUP BY TABLE_SCHEMA, TABLE_NAME;
  " | tail -n 1
}

export_table_json() {
  local table_name="${1}"
  local output_file="${2}"
  local json_query

  json_query="$(build_json_query "${table_name}")"
  if [[ -z "${json_query}" ]]; then
    echo "[market-source] ERROR: could not build export query for ${table_name}" >&2
    exit 1
  fi

  mysql_exec "${json_query}" > "${output_file}"
}

mysql_column_exists() {
  local table_name="${1}"
  local column_name="${2}"

  [[ "$(
    mysql_exec "
      SELECT EXISTS(
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = '${DB_NAME}'
          AND TABLE_NAME = '${table_name}'
          AND COLUMN_NAME = '${column_name}'
      );
    " | tail -n 1
  )" == "1" ]]
}

if mysql_column_exists "HYPERSCALE_FACILITY" "COUNTY_FIPS"; then
  HYPERSCALE_COUNTY_FIPS_EXPR="facility.COUNTY_FIPS"
else
  HYPERSCALE_COUNTY_FIPS_EXPR="CAST(NULL AS CHAR)"
fi

export_table_json "MARKET_GROUP" "${TMP_DIR}/market-groups.ndjson"
export_table_json "WORLD_REGION" "${TMP_DIR}/world-regions.ndjson"
export_table_json "HAWK_MARKET" "${TMP_DIR}/markets.ndjson"
export_table_json "HAWK_SUBMARKET" "${TMP_DIR}/submarkets.ndjson"
export_table_json "HAWK_MARKET_QUARTERLY_DATA" "${TMP_DIR}/market-quarterly-data.ndjson"
export_table_json "HAWK_MARKET_YEARLY_DATA" "${TMP_DIR}/market-yearly-data.ndjson"
export_table_json "HAWK_MARKET_TOTALS_DATA" "${TMP_DIR}/market-totals-data.ndjson"
export_table_json "HAWK_MARKET_UPDATES" "${TMP_DIR}/market-updates.ndjson"
export_table_json "HAWK_MARKET_CAP_REPORT" "${TMP_DIR}/market-cap-reports.ndjson"
export_table_json "HAWK_COMPANY" "${TMP_DIR}/companies.ndjson"
export_table_json "HAWK_POWER_SPACE_INFO" "${TMP_DIR}/power-space-info.ndjson"
export_table_json "HAWK_FACILITY_QUARTERLY_DATA" "${TMP_DIR}/facility-quarterly-data.ndjson"
export_table_json "HYPERSCALE_FACILITY" "${TMP_DIR}/hyperscale-facility-current.ndjson"
export_table_json "HYPERSCALE_HISTORICAL_CAPACITY" "${TMP_DIR}/hyperscale-historical-capacity.ndjson"
export_table_json "HYPERSCALE_COMPANY_LEASE_TOTAL" "${TMP_DIR}/hyperscale-company-lease-total.ndjson"
export_table_json "HS_GRID_COMPANY_MARKET_LEASE_TOTAL" "${TMP_DIR}/hs-grid-company-market-lease-total.ndjson"
export_table_json "INSIGHT_FORECAST" "${TMP_DIR}/insight-forecast.ndjson"
export_table_json "INSIGHT_PRICING_FORECAST" "${TMP_DIR}/insight-pricing-forecast.ndjson"

mysql_exec "
  SELECT JSON_OBJECT(
    'product_id', product.PRODUCT_ID,
    'market_id', product.MARKET_ID,
    'facility_location_id', facility_location.FACILITY_LOCATION_ID,
    'address_line1', facility_location.ADDRESS_LINE1,
    'city', facility_location.CITY,
    'state', facility_location.STATE,
    'country', facility_location.COUNTRY,
    'county_fips', facility_location.COUNTY_FIPS,
    'latitude', facility_location.LATITUDE,
    'longitude', facility_location.LONGITUDE
  )
  FROM HAWK_PRODUCT product
  JOIN HAWK_FACILITY_LOCATION facility_location
    ON facility_location.FACILITY_LOCATION_ID = product.FACILITY_LOCATION_ID
  WHERE product.FACILITY_LOCATION_ID IS NOT NULL;
" > "${TMP_DIR}/product-facility-locations.ndjson"

mysql_exec "
  SELECT JSON_OBJECT(
    'facility_id', facility.FACILITY_ID,
    'facility_name', facility.FACILITY_NAME,
    'market_id', market.MARKET_ID,
    'submarket_id', submarket.SUBMARKET_ID,
    'market_name', market.NAME,
    'submarket_name', submarket.NAME,
    'company_id', company.COMPANY_ID,
    'company_name', company.COMPANY_NAME,
    'power_capacity_mw', facility.POWER_CAPACITY_MW,
    'critical_load_mw', facility.CRITICAL_LOAD_MW,
    'county_fips', ${HYPERSCALE_COUNTY_FIPS_EXPR}
  )
  FROM HYPERSCALE_FACILITY facility
  LEFT JOIN HAWK_MARKET market
    ON market.MARKET_ID = facility.MARKET_ID
  LEFT JOIN HAWK_SUBMARKET submarket
    ON submarket.SUBMARKET_ID = facility.SUBMARKET_ID
  LEFT JOIN HAWK_COMPANY company
    ON company.COMPANY_ID = facility.COMPANY_ID;
" > "${TMP_DIR}/hyperscale-facilities.ndjson"

psql "${DB_URL}" \
  --set ON_ERROR_STOP=1 \
  --file "${SCHEMA_SQL}"

for file_name in \
  market-groups \
  world-regions \
  markets \
  submarkets \
  market-quarterly-data \
  market-yearly-data \
  market-totals-data \
  market-updates \
  market-cap-reports \
  companies \
  power-space-info \
  facility-quarterly-data \
  product-facility-locations \
  hyperscale-facility-current \
  hyperscale-historical-capacity \
  hyperscale-company-lease-total \
  hs-grid-company-market-lease-total \
  insight-forecast \
  insight-pricing-forecast \
  hyperscale-facilities
do
  psql "${DB_URL}" \
    --set ON_ERROR_STOP=1 \
    --command "\\copy market_source.${file_name//-/_} FROM '${TMP_DIR}/${file_name}.ndjson'"
done
