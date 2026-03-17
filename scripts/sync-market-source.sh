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

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"

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

export_table_json "MARKET_GROUP" "${TMP_DIR}/market-groups.ndjson"
export_table_json "WORLD_REGION" "${TMP_DIR}/world-regions.ndjson"
export_table_json "HAWK_MARKET" "${TMP_DIR}/markets.ndjson"
export_table_json "HAWK_SUBMARKET" "${TMP_DIR}/submarkets.ndjson"
export_table_json "HAWK_MARKET_QUARTERLY_DATA" "${TMP_DIR}/market-quarterly-data.ndjson"
export_table_json "HAWK_MARKET_YEARLY_DATA" "${TMP_DIR}/market-yearly-data.ndjson"
export_table_json "HAWK_MARKET_TOTALS_DATA" "${TMP_DIR}/market-totals-data.ndjson"
export_table_json "HAWK_MARKET_UPDATES" "${TMP_DIR}/market-updates.ndjson"
export_table_json "HAWK_MARKET_CAP_REPORT" "${TMP_DIR}/market-cap-reports.ndjson"

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
  FROM BLC_PRODUCT AS product
  INNER JOIN HAWK_FACILITY_LOCATION AS facility_location
    ON facility_location.FACILITY_LOCATION_ID = product.FACILITY_LOCATION_ID
  WHERE product.PRODUCT_TYPE = 'COLOCATION'
    AND COALESCE(product.ARCHIVED, 'N') <> 'Y'
    AND COALESCE(product.OPT_OUT, '0') = '0'
    AND product.MARKET_ID IS NOT NULL
    AND facility_location.LATITUDE IS NOT NULL
    AND facility_location.LONGITUDE IS NOT NULL
  ORDER BY product.PRODUCT_ID;
" > "${TMP_DIR}/colocation-points.ndjson"

mysql_exec "
  SELECT JSON_OBJECT(
    'point_id', facility.ID,
    'market_id', facility.MARKET,
    'submarket_id', facility.SUBMARKET_ID,
    'company', facility.COMPANY,
    'facility_code', COALESCE(
      NULLIF(TRIM(facility.FACILITY_CODE), ''),
      NULLIF(TRIM(facility.BUILDING_DESIGNATION), '')
    ),
    'address', facility.ADDRESS,
    'city', facility.CITY,
    'state', facility.STATE,
    'country', facility.COUNTRY,
    'county_fips', facility.COUNTY_FIPS,
    'facility_status', facility.FACILITY_STATUS,
    'lease_or_own', facility.LEASE_OR_OWN,
    'latitude', facility.LATITUDE,
    'longitude', facility.LONGITUDE,
    'updated_at', facility.DATE_UPDATED
  )
  FROM HYPERSCALE_FACILITY AS facility
  WHERE COALESCE(facility.ARCHIVED, 'N') <> 'Y'
    AND facility.MARKET IS NOT NULL
    AND facility.LATITUDE IS NOT NULL
    AND facility.LONGITUDE IS NOT NULL
  ORDER BY facility.ID;
" > "${TMP_DIR}/hyperscale-points.ndjson"

psql \
  "${DB_URL}" \
  -v ON_ERROR_STOP=1 <<SQL
BEGIN;

TRUNCATE TABLE market_source.market_cap_reports;
TRUNCATE TABLE market_source.market_totals_data;
TRUNCATE TABLE market_source.market_yearly_data;
TRUNCATE TABLE market_source.market_quarterly_data;
TRUNCATE TABLE market_source.market_updates;
TRUNCATE TABLE market_source.submarkets;
TRUNCATE TABLE market_source.colocation_points;
TRUNCATE TABLE market_source.hyperscale_points;
TRUNCATE TABLE market_source.markets;
TRUNCATE TABLE market_source.world_regions;
TRUNCATE TABLE market_source.market_groups;

CREATE TEMP TABLE market_groups_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE world_regions_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE markets_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE submarkets_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE market_quarterly_data_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE market_yearly_data_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE market_totals_data_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE market_updates_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE market_cap_reports_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE colocation_points_stage (payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE hyperscale_points_stage (payload jsonb NOT NULL) ON COMMIT DROP;

\copy market_groups_stage(payload) FROM '${TMP_DIR}/market-groups.ndjson'
\copy world_regions_stage(payload) FROM '${TMP_DIR}/world-regions.ndjson'
\copy markets_stage(payload) FROM '${TMP_DIR}/markets.ndjson'
\copy submarkets_stage(payload) FROM '${TMP_DIR}/submarkets.ndjson'
\copy market_quarterly_data_stage(payload) FROM '${TMP_DIR}/market-quarterly-data.ndjson'
\copy market_yearly_data_stage(payload) FROM '${TMP_DIR}/market-yearly-data.ndjson'
\copy market_totals_data_stage(payload) FROM '${TMP_DIR}/market-totals-data.ndjson'
\copy market_updates_stage(payload) FROM '${TMP_DIR}/market-updates.ndjson'
\copy market_cap_reports_stage(payload) FROM '${TMP_DIR}/market-cap-reports.ndjson'
\copy colocation_points_stage(payload) FROM '${TMP_DIR}/colocation-points.ndjson'
\copy hyperscale_points_stage(payload) FROM '${TMP_DIR}/hyperscale-points.ndjson'

INSERT INTO market_source.market_groups (
  market_group_id,
  name,
  payload
)
SELECT
  payload->>'ID' AS market_group_id,
  NULLIF(BTRIM(payload->>'NAME'), '') AS name,
  payload
FROM market_groups_stage
WHERE NULLIF(BTRIM(payload->>'ID'), '') IS NOT NULL;

INSERT INTO market_source.world_regions (
  world_region_id,
  name,
  url,
  abbreviation,
  sort_order,
  latitude,
  longitude,
  center,
  boundary,
  zoom_level,
  payload
)
SELECT
  payload->>'ID' AS world_region_id,
  NULLIF(BTRIM(payload->>'NAME'), '') AS name,
  NULLIF(BTRIM(payload->>'URL'), '') AS url,
  NULLIF(BTRIM(payload->>'ABBREVIATION'), '') AS abbreviation,
  CASE
    WHEN NULLIF(BTRIM(payload->>'SORT_ORDER'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'SORT_ORDER')::integer
    ELSE NULL
  END AS sort_order,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LATITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LATITUDE')::double precision
    ELSE NULL
  END AS latitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LONGITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LONGITUDE')::double precision
    ELSE NULL
  END AS longitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LATITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'LONGITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN ST_SetSRID(
        ST_MakePoint(
          (payload->>'LONGITUDE')::double precision,
          (payload->>'LATITUDE')::double precision
        ),
        4326
      )
    ELSE NULL
  END AS center,
  CASE
    WHEN NULLIF(BTRIM(payload->>'BOUNDARY_SOUTH_WEST_LNG'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'BOUNDARY_SOUTH_WEST_LAT'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'BOUNDARY_NORTH_EAST_LNG'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'BOUNDARY_NORTH_EAST_LAT'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN ST_MakeEnvelope(
        (payload->>'BOUNDARY_SOUTH_WEST_LNG')::double precision,
        (payload->>'BOUNDARY_SOUTH_WEST_LAT')::double precision,
        (payload->>'BOUNDARY_NORTH_EAST_LNG')::double precision,
        (payload->>'BOUNDARY_NORTH_EAST_LAT')::double precision,
        4326
      )
    ELSE NULL
  END AS boundary,
  CASE
    WHEN NULLIF(BTRIM(payload->>'ZOOM_LEVEL'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'ZOOM_LEVEL')::integer
    ELSE NULL
  END AS zoom_level,
  payload
FROM world_regions_stage
WHERE NULLIF(BTRIM(payload->>'ID'), '') IS NOT NULL;

INSERT INTO market_source.markets (
  market_id,
  name,
  region,
  search_region,
  country,
  state,
  latitude,
  longitude,
  center,
  absorption,
  vacancy,
  search_page,
  front_page,
  international,
  short_description,
  synopsis,
  search_market_description,
  provider_overview_description,
  market_solutions_description,
  site_stats_description,
  url,
  zoom_level,
  market_group_id,
  world_region_id,
  updated_at,
  payload
)
SELECT
  payload->>'MARKET_ID' AS market_id,
  COALESCE(NULLIF(BTRIM(payload->>'NAME'), ''), payload->>'MARKET_ID') AS name,
  NULLIF(BTRIM(payload->>'REGION'), '') AS region,
  NULLIF(BTRIM(payload->>'SEARCH_REGION'), '') AS search_region,
  NULLIF(BTRIM(payload->>'COUNTRY'), '') AS country,
  NULLIF(BTRIM(payload->>'STATE'), '') AS state,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LATITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LATITUDE')::double precision
    ELSE NULL
  END AS latitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LONGITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LONGITUDE')::double precision
    ELSE NULL
  END AS longitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LATITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'LONGITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN ST_SetSRID(
        ST_MakePoint(
          (payload->>'LONGITUDE')::double precision,
          (payload->>'LATITUDE')::double precision
        ),
        4326
      )
    ELSE NULL
  END AS center,
  CASE
    WHEN NULLIF(BTRIM(payload->>'ABSORPTION'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'ABSORPTION')::numeric
    ELSE NULL
  END AS absorption,
  CASE
    WHEN NULLIF(BTRIM(payload->>'VACANCY'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'VACANCY')::numeric
    ELSE NULL
  END AS vacancy,
  COALESCE(NULLIF(BTRIM(payload->>'SEARCH_PAGE'), ''), '0') IN ('1', 'true', 'TRUE', 'y', 'Y') AS search_page,
  COALESCE(NULLIF(BTRIM(payload->>'FRONT_PAGE'), ''), '0') IN ('1', 'true', 'TRUE', 'y', 'Y') AS front_page,
  COALESCE(NULLIF(BTRIM(payload->>'INTERNATIONAL'), ''), '0') IN ('1', 'true', 'TRUE', 'y', 'Y') AS international,
  NULLIF(BTRIM(payload->>'SHORT_DESCRIPTION'), '') AS short_description,
  NULLIF(BTRIM(payload->>'SYNOPSIS'), '') AS synopsis,
  NULLIF(BTRIM(payload->>'SEARCH_MARKET_DESCRIPTION'), '') AS search_market_description,
  NULLIF(BTRIM(payload->>'PROVIDER_OVERVIEW_DESCRIPTION'), '') AS provider_overview_description,
  NULLIF(BTRIM(payload->>'MARKET_SOLUTIONS_DESCRIPTION'), '') AS market_solutions_description,
  NULLIF(BTRIM(payload->>'SITE_STATS_DESCRIPTION'), '') AS site_stats_description,
  NULLIF(BTRIM(payload->>'URL'), '') AS url,
  CASE
    WHEN NULLIF(BTRIM(payload->>'ZOOM_LEVEL'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'ZOOM_LEVEL')::integer
    ELSE NULL
  END AS zoom_level,
  NULLIF(BTRIM(payload->>'MARKET_GROUP_ID'), '') AS market_group_id,
  NULLIF(BTRIM(payload->>'WORLD_REGION_ID'), '') AS world_region_id,
  CASE
    WHEN NULLIF(BTRIM(payload->>'DATE_UPDATED'), '') IS NULL THEN NULL
    ELSE (payload->>'DATE_UPDATED')::timestamptz
  END AS updated_at,
  payload
FROM markets_stage
WHERE NULLIF(BTRIM(payload->>'MARKET_ID'), '') IS NOT NULL;

INSERT INTO market_source.submarkets (
  submarket_id,
  market_id,
  name,
  latitude,
  longitude,
  geom,
  payload
)
SELECT
  payload->>'SUBMARKET_ID' AS submarket_id,
  NULLIF(BTRIM(payload->>'MARKET_ID'), '') AS market_id,
  NULLIF(BTRIM(payload->>'NAME'), '') AS name,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LATITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LATITUDE')::double precision
    ELSE NULL
  END AS latitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LONGITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LONGITUDE')::double precision
    ELSE NULL
  END AS longitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LATITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'LONGITUDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN ST_SetSRID(
        ST_MakePoint(
          (payload->>'LONGITUDE')::double precision,
          (payload->>'LATITUDE')::double precision
        ),
        4326
      )
    ELSE NULL
  END AS geom,
  payload
FROM submarkets_stage
WHERE NULLIF(BTRIM(payload->>'SUBMARKET_ID'), '') IS NOT NULL;

INSERT INTO market_source.market_quarterly_data (
  quarterly_data_id,
  market_id,
  year,
  quarter,
  available_power,
  commissioned_power,
  planned_dc_power,
  uc_power,
  absorption_override,
  preleasing,
  preleasing_override,
  date_updated,
  payload
)
SELECT
  payload->>'QUARTERLY_DATA_ID' AS quarterly_data_id,
  NULLIF(BTRIM(payload->>'MARKET_ID'), '') AS market_id,
  CASE
    WHEN NULLIF(BTRIM(payload->>'YEAR'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'YEAR')::integer
    ELSE NULL
  END AS year,
  CASE
    WHEN NULLIF(BTRIM(payload->>'QUARTER'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'QUARTER')::integer
    ELSE NULL
  END AS quarter,
  CASE
    WHEN NULLIF(BTRIM(payload->>'AVAILABLE_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'AVAILABLE_POWER')::numeric
    ELSE NULL
  END AS available_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'COMMISSIONED_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'COMMISSIONED_POWER')::numeric
    ELSE NULL
  END AS commissioned_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'PLANNED_DC_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'PLANNED_DC_POWER')::numeric
    ELSE NULL
  END AS planned_dc_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'UC_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'UC_POWER')::numeric
    ELSE NULL
  END AS uc_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'ABSORPTION_OVERRIDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'ABSORPTION_OVERRIDE')::numeric
    ELSE NULL
  END AS absorption_override,
  CASE
    WHEN NULLIF(BTRIM(payload->>'PRELEASING'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'PRELEASING')::integer
    ELSE NULL
  END AS preleasing,
  CASE
    WHEN NULLIF(BTRIM(payload->>'PRELEASING_OVERRIDE'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'PRELEASING_OVERRIDE')::numeric
    ELSE NULL
  END AS preleasing_override,
  CASE
    WHEN NULLIF(BTRIM(payload->>'DATE_UPDATED'), '') IS NULL THEN NULL
    ELSE (payload->>'DATE_UPDATED')::timestamptz
  END AS date_updated,
  payload
FROM market_quarterly_data_stage
WHERE NULLIF(BTRIM(payload->>'QUARTERLY_DATA_ID'), '') IS NOT NULL;

INSERT INTO market_source.market_yearly_data (
  yearly_data_id,
  market_id,
  year,
  absorption,
  high_range_min,
  high_range_max,
  low_range_min,
  low_range_max,
  hyper_min,
  hyper_max,
  date_updated,
  payload
)
SELECT
  payload->>'YEARLY_DATA_ID' AS yearly_data_id,
  NULLIF(BTRIM(payload->>'MARKET_ID'), '') AS market_id,
  CASE
    WHEN NULLIF(BTRIM(payload->>'YEAR'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'YEAR')::integer
    ELSE NULL
  END AS year,
  CASE
    WHEN NULLIF(BTRIM(payload->>'ABSORPTION'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'ABSORPTION')::numeric
    ELSE NULL
  END AS absorption,
  CASE
    WHEN NULLIF(BTRIM(payload->>'HIGH_RANGE_MIN'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'HIGH_RANGE_MIN')::numeric
    ELSE NULL
  END AS high_range_min,
  CASE
    WHEN NULLIF(BTRIM(payload->>'HIGH_RANGE_MAX'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'HIGH_RANGE_MAX')::numeric
    ELSE NULL
  END AS high_range_max,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LOW_RANGE_MIN'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LOW_RANGE_MIN')::numeric
    ELSE NULL
  END AS low_range_min,
  CASE
    WHEN NULLIF(BTRIM(payload->>'LOW_RANGE_MAX'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'LOW_RANGE_MAX')::numeric
    ELSE NULL
  END AS low_range_max,
  CASE
    WHEN NULLIF(BTRIM(payload->>'HYPER_MIN'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'HYPER_MIN')::numeric
    ELSE NULL
  END AS hyper_min,
  CASE
    WHEN NULLIF(BTRIM(payload->>'HYPER_MAX'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'HYPER_MAX')::numeric
    ELSE NULL
  END AS hyper_max,
  CASE
    WHEN NULLIF(BTRIM(payload->>'DATE_UPDATED'), '') IS NULL THEN NULL
    ELSE (payload->>'DATE_UPDATED')::timestamptz
  END AS date_updated,
  payload
FROM market_yearly_data_stage
WHERE NULLIF(BTRIM(payload->>'YEARLY_DATA_ID'), '') IS NOT NULL;

INSERT INTO market_source.market_totals_data (
  market_totals_data_id,
  market_id,
  year,
  quarter,
  available_power,
  available_sf,
  commissioned_power,
  commissioned_sf,
  planned_power,
  planned_sf,
  uc_power,
  uc_sf,
  payload
)
SELECT
  payload->>'MARKET_TOTALS_DATA_ID' AS market_totals_data_id,
  NULLIF(BTRIM(payload->>'MARKET_ID'), '') AS market_id,
  CASE
    WHEN NULLIF(BTRIM(payload->>'YEAR'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'YEAR')::integer
    ELSE NULL
  END AS year,
  CASE
    WHEN NULLIF(BTRIM(payload->>'QUARTER'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'QUARTER')::integer
    ELSE NULL
  END AS quarter,
  CASE
    WHEN NULLIF(BTRIM(payload->>'AVAILABLE_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'AVAILABLE_POWER')::numeric
    ELSE NULL
  END AS available_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'AVAILABLE_SF'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'AVAILABLE_SF')::numeric
    ELSE NULL
  END AS available_sf,
  CASE
    WHEN NULLIF(BTRIM(payload->>'COMISSIONED_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'COMISSIONED_POWER')::numeric
    ELSE NULL
  END AS commissioned_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'COMMISSIONED_SF'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'COMMISSIONED_SF')::numeric
    ELSE NULL
  END AS commissioned_sf,
  CASE
    WHEN NULLIF(BTRIM(payload->>'PLANNED_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'PLANNED_POWER')::numeric
    ELSE NULL
  END AS planned_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'PLANNED_SF'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'PLANNED_SF')::numeric
    ELSE NULL
  END AS planned_sf,
  CASE
    WHEN NULLIF(BTRIM(payload->>'UC_POWER'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'UC_POWER')::numeric
    ELSE NULL
  END AS uc_power,
  CASE
    WHEN NULLIF(BTRIM(payload->>'UC_SF'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'UC_SF')::numeric
    ELSE NULL
  END AS uc_sf,
  payload
FROM market_totals_data_stage
WHERE NULLIF(BTRIM(payload->>'MARKET_TOTALS_DATA_ID'), '') IS NOT NULL;

INSERT INTO market_source.market_updates (
  market_id,
  year,
  quarter,
  market_updates,
  payload
)
SELECT
  NULLIF(BTRIM(payload->>'market_id'), '') AS market_id,
  CASE
    WHEN NULLIF(BTRIM(payload->>'year'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'year')::integer
    ELSE NULL
  END AS year,
  CASE
    WHEN NULLIF(BTRIM(payload->>'quarter'), '') ~ '^-?[0-9]+$'
      THEN (payload->>'quarter')::integer
    ELSE NULL
  END AS quarter,
  NULLIF(BTRIM(payload->>'MARKET_UPDATES'), '') AS market_updates,
  payload
FROM market_updates_stage
WHERE NULLIF(BTRIM(payload->>'market_id'), '') IS NOT NULL
  AND NULLIF(BTRIM(payload->>'year'), '') ~ '^-?[0-9]+$'
  AND NULLIF(BTRIM(payload->>'quarter'), '') ~ '^-?[0-9]+$';

INSERT INTO market_source.market_cap_reports (
  cap_report_id,
  market_id,
  retail_available_total,
  retail_commissioned_total,
  retail_planned_total,
  retail_under_construction_total,
  payload
)
SELECT
  payload->>'ID' AS cap_report_id,
  NULLIF(BTRIM(payload->>'MARKET_ID'), '') AS market_id,
  CASE
    WHEN NULLIF(BTRIM(payload->>'RETAIL_AVAILABLE_TOTAL'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'RETAIL_AVAILABLE_TOTAL')::numeric
    ELSE NULL
  END AS retail_available_total,
  CASE
    WHEN NULLIF(BTRIM(payload->>'RETAIL_COMMISSIONED_TOTAL'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'RETAIL_COMMISSIONED_TOTAL')::numeric
    ELSE NULL
  END AS retail_commissioned_total,
  CASE
    WHEN NULLIF(BTRIM(payload->>'RETAIL_PLANNED_TOTAL'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'RETAIL_PLANNED_TOTAL')::numeric
    ELSE NULL
  END AS retail_planned_total,
  CASE
    WHEN NULLIF(BTRIM(payload->>'RETAIL_UNDER_CONSTRUCTION_TOTAL'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'RETAIL_UNDER_CONSTRUCTION_TOTAL')::numeric
    ELSE NULL
  END AS retail_under_construction_total,
  payload
FROM market_cap_reports_stage
WHERE NULLIF(BTRIM(payload->>'ID'), '') IS NOT NULL;

INSERT INTO market_source.colocation_points (
  point_id,
  market_id,
  facility_location_id,
  address_line1,
  city,
  state,
  country,
  county_fips,
  latitude,
  longitude,
  geom,
  payload
)
SELECT
  payload->>'product_id' AS point_id,
  NULLIF(BTRIM(payload->>'market_id'), '') AS market_id,
  NULLIF(BTRIM(payload->>'facility_location_id'), '') AS facility_location_id,
  NULLIF(BTRIM(payload->>'address_line1'), '') AS address_line1,
  NULLIF(BTRIM(payload->>'city'), '') AS city,
  NULLIF(BTRIM(payload->>'state'), '') AS state,
  NULLIF(BTRIM(payload->>'country'), '') AS country,
  NULLIF(BTRIM(payload->>'county_fips'), '') AS county_fips,
  CASE
    WHEN NULLIF(BTRIM(payload->>'latitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'latitude')::double precision
    ELSE NULL
  END AS latitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'longitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'longitude')::double precision
    ELSE NULL
  END AS longitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'latitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'longitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN ST_SetSRID(
        ST_MakePoint(
          (payload->>'longitude')::double precision,
          (payload->>'latitude')::double precision
        ),
        4326
      )
    ELSE NULL
  END AS geom,
  payload
FROM colocation_points_stage
WHERE NULLIF(BTRIM(payload->>'product_id'), '') IS NOT NULL;

INSERT INTO market_source.hyperscale_points (
  point_id,
  market_id,
  submarket_id,
  company,
  facility_code,
  address,
  city,
  state,
  country,
  county_fips,
  facility_status,
  lease_or_own,
  latitude,
  longitude,
  geom,
  updated_at,
  payload
)
SELECT
  payload->>'point_id' AS point_id,
  NULLIF(BTRIM(payload->>'market_id'), '') AS market_id,
  NULLIF(BTRIM(payload->>'submarket_id'), '') AS submarket_id,
  NULLIF(BTRIM(payload->>'company'), '') AS company,
  NULLIF(BTRIM(payload->>'facility_code'), '') AS facility_code,
  NULLIF(BTRIM(payload->>'address'), '') AS address,
  NULLIF(BTRIM(payload->>'city'), '') AS city,
  NULLIF(BTRIM(payload->>'state'), '') AS state,
  NULLIF(BTRIM(payload->>'country'), '') AS country,
  NULLIF(BTRIM(payload->>'county_fips'), '') AS county_fips,
  NULLIF(BTRIM(payload->>'facility_status'), '') AS facility_status,
  NULLIF(BTRIM(payload->>'lease_or_own'), '') AS lease_or_own,
  CASE
    WHEN NULLIF(BTRIM(payload->>'latitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'latitude')::double precision
    ELSE NULL
  END AS latitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'longitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (payload->>'longitude')::double precision
    ELSE NULL
  END AS longitude,
  CASE
    WHEN NULLIF(BTRIM(payload->>'latitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      AND NULLIF(BTRIM(payload->>'longitude'), '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN ST_SetSRID(
        ST_MakePoint(
          (payload->>'longitude')::double precision,
          (payload->>'latitude')::double precision
        ),
        4326
      )
    ELSE NULL
  END AS geom,
  CASE
    WHEN NULLIF(BTRIM(payload->>'updated_at'), '') IS NULL THEN NULL
    ELSE (payload->>'updated_at')::timestamptz
  END AS updated_at,
  payload
FROM hyperscale_points_stage
WHERE NULLIF(BTRIM(payload->>'point_id'), '') IS NOT NULL;

ANALYZE market_source.market_groups;
ANALYZE market_source.world_regions;
ANALYZE market_source.markets;
ANALYZE market_source.submarkets;
ANALYZE market_source.market_quarterly_data;
ANALYZE market_source.market_yearly_data;
ANALYZE market_source.market_totals_data;
ANALYZE market_source.market_updates;
ANALYZE market_source.market_cap_reports;
ANALYZE market_source.colocation_points;
ANALYZE market_source.hyperscale_points;

COMMIT;
SQL

echo "[market-source] refreshed canonical market source tables"
