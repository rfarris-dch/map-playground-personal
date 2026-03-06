#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

: "${POSTGRES_URL:?POSTGRES_URL must be set}"
: "${DB_HOST:=localhost}"
: "${DB_PORT:=3306}"
: "${DB_USER:=dch}"
: "${DB_PASSWORD:=}"
: "${DB_NAME:=hawksuite}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/facility-sync.XXXXXX")"
COLO_JSON_FILE="${TMP_DIR}/colo.jsonl"
HYPERSCALE_JSON_FILE="${TMP_DIR}/hyperscale.jsonl"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

MYSQL_CMD=(
  mysql
  --default-character-set=utf8mb4
  --batch
  --raw
  --skip-column-names
  -h "${DB_HOST}"
  -P "${DB_PORT}"
  -u "${DB_USER}"
)

if [[ -n "${DB_PASSWORD}" ]]; then
  MYSQL_CMD+=(-p"${DB_PASSWORD}")
fi

MYSQL_CMD+=("${DB_NAME}")

COLO_EXPORT_QUERY="$(cat <<'SQL'
SELECT JSON_OBJECT(
  'facility_id', CONCAT('colo:', P.PRODUCT_ID),
  'facility_slug', COALESCE(NULLIF(TRIM(P.EXTERNAL_ID), ''), CONCAT('colo-', P.PRODUCT_ID)),
  'facility_name', COALESCE(NULLIF(TRIM(FL.ADDRESS_LINE1), ''), CONCAT('Facility ', P.PRODUCT_ID)),
  'provider_id', CAST(P.PROVIDER_ID AS CHAR),
  'provider_slug', COALESCE(NULLIF(TRIM(PP.short_name), ''), NULLIF(TRIM(PP.NAME), '')),
  'county_fips', NULLIF(TRIM(FL.COUNTY_FIPS), ''),
  'state_abbrev', NULLIF(TRIM(FL.STATE), ''),
  'commissioned_power_mw', ROUND(COALESCE(PSI.COMISSIONED_POWER, 0) / 1000, 2),
  'planned_power_mw', ROUND(COALESCE(PSI.PLANNED_DC_POWER, 0) / 1000, 2),
  'under_construction_power_mw', ROUND(COALESCE(PSI.UC_POWER, 0) / 1000, 2),
  'available_power_mw', ROUND(COALESCE(PSI.AVAILABLE_POWER, 0) / 1000, 2),
  'facility_status', NULLIF(TRIM(P.FACILITY_STATUS), ''),
  'latitude', FL.LATITUDE,
  'longitude', FL.LONGITUDE,
  'source_dataset_date', DATE(GREATEST(
    COALESCE(P.DATE_UPDATED, '1000-01-01'),
    COALESCE(PP.DATE_UPDATED, '1000-01-01'),
    COALESCE(FL.DATE_UPDATED, '1000-01-01'),
    COALESCE(PSI.DATE_UPDATED, '1000-01-01'),
    COALESCE(FI.DATE_UPDATED, '1000-01-01'),
    COALESCE(EMR.DATE_UPDATED, '1000-01-01'),
    COALESCE(SI.DATE_UPDATED, '1000-01-01')
  )),
  'product_id', CAST(P.PRODUCT_ID AS CHAR),
  'external_id', NULLIF(TRIM(P.EXTERNAL_ID), ''),
  'facility_location_id', CAST(P.FACILITY_LOCATION_ID AS CHAR),
  'facility_info_id', CAST(P.FACILITY_INFO_ID AS CHAR),
  'power_space_info_id', CAST(P.POWER_SPACE_INFO_ID AS CHAR),
  'security_info_id', CAST(P.SECURITY_INFO_ID AS CHAR),
  'elecmech_info_id', CAST(P.ELECMECH_INFO_ID AS CHAR)
)
FROM BLC_PRODUCT AS P
INNER JOIN HAWK_PROVIDER_PROFILE AS PP
  ON PP.PROVIDER_PROFILE_ID = P.PROVIDER_ID
INNER JOIN HAWK_FACILITY_LOCATION AS FL
  ON FL.FACILITY_LOCATION_ID = P.FACILITY_LOCATION_ID
INNER JOIN HAWK_MARKET AS M
  ON M.MARKET_ID = P.MARKET_ID
INNER JOIN WORLD_REGION AS WR
  ON WR.ID = M.WORLD_REGION_ID
INNER JOIN HAWK_POWER_SPACE_INFO AS PSI
  ON PSI.POWER_SPACE_INFO_ID = P.POWER_SPACE_INFO_ID
INNER JOIN HAWK_FACILITY_INFO AS FI
  ON FI.FACILITY_INFO_ID = P.FACILITY_INFO_ID
INNER JOIN HAWK_ELEC_MECH_REDUNDANCY AS EMR
  ON EMR.REDUNDANCY_ID = P.ELECMECH_INFO_ID
INNER JOIN HAWK_SECURITY_INFO AS SI
  ON SI.SECURITY_INFO_ID = P.SECURITY_INFO_ID
WHERE P.ARCHIVED != 'Y'
  AND P.SNDBX_ID IS NULL
  AND P.OPT_OUT = 0
  AND P.PRODUCT_TYPE = 'COLOCATION'
GROUP BY P.PRODUCT_ID
ORDER BY P.PRODUCT_ID;
SQL
)"

HYPERSCALE_EXPORT_QUERY="$(cat <<'SQL'
SELECT JSON_OBJECT(
  'hyperscale_id', TRIM(HSF.EXTERNAL_ID),
  'facility_code', NULLIF(TRIM(HSF.FACILITY_CODE), ''),
  'facility_name', COALESCE(NULLIF(TRIM(HSP.NAME), ''), CONCAT('Hyperscale ', HSF.ID)),
  'provider_id', CAST(HSP.ID AS CHAR),
  'provider_slug', COALESCE(NULLIF(TRIM(HSP.SHORT_NAME), ''), NULLIF(TRIM(HSP.NAME), '')),
  'county_fips', NULLIF(TRIM(HSF.COUNTY_FIPS), ''),
  'state_abbrev', NULLIF(TRIM(HSF.STATE), ''),
  'lease_or_own', NULLIF(TRIM(HSF.LEASE_OR_OWN), ''),
  'commissioned_power_mw', ROUND(COALESCE(HSF.COMMISSIONED_POWER, 0), 2),
  'planned_power_mw', ROUND(COALESCE(HSF.PLANNED_POWER, 0), 2),
  'under_construction_power_mw', ROUND(COALESCE(HSF.UNDER_CONSTRUCTION_POWER, 0), 2),
  'facility_status', NULLIF(TRIM(HSF.FACILITY_STATUS), ''),
  'latitude', HSF.LATITUDE,
  'longitude', HSF.LONGITUDE,
  'source_dataset_date', DATE(GREATEST(
    COALESCE(HSF.DATE_UPDATED, '1000-01-01'),
    COALESCE(HSP.DATE_UPDATED, '1000-01-01')
  )),
  'facility_row_id', CAST(HSF.ID AS CHAR),
  'external_id', TRIM(HSF.EXTERNAL_ID)
)
FROM HYPERSCALE_FACILITY AS HSF
INNER JOIN HYPERSCALE_PROVIDER AS HSP
  ON HSP.ID = HSF.COMPANY
INNER JOIN HAWK_MARKET AS M
  ON M.MARKET_ID = HSF.MARKET
INNER JOIN WORLD_REGION AS WR
  ON WR.ID = M.WORLD_REGION_ID
LEFT JOIN CLOUD_REGION AS CR
  ON CR.ID = HSF.CLOUD_REGION
WHERE COALESCE(HSF.ARCHIVED, 'N') != 'Y'
  AND HSF.SNDBX_ID IS NULL
ORDER BY HSF.EXTERNAL_ID;
SQL
)"

echo "[sync] export colocation rows from hawksuite"
"${MYSQL_CMD[@]}" -e "${COLO_EXPORT_QUERY}" > "${COLO_JSON_FILE}"

echo "[sync] export hyperscale rows from hawksuite"
"${MYSQL_CMD[@]}" -e "${HYPERSCALE_EXPORT_QUERY}" > "${HYPERSCALE_JSON_FILE}"

echo "[sync] refresh serve.facility_site and serve.hyperscale_site"
psql "${POSTGRES_URL}" \
  -v ON_ERROR_STOP=1 <<SQL
BEGIN;

ALTER TABLE serve.facility_site
  ALTER COLUMN county_fips DROP NOT NULL,
  ALTER COLUMN state_abbrev DROP NOT NULL,
  ALTER COLUMN geom DROP NOT NULL,
  ALTER COLUMN geom_3857 DROP NOT NULL,
  ALTER COLUMN geog DROP NOT NULL;

ALTER TABLE serve.hyperscale_site
  ALTER COLUMN county_fips DROP NOT NULL,
  ALTER COLUMN state_abbrev DROP NOT NULL,
  ALTER COLUMN geom DROP NOT NULL,
  ALTER COLUMN geom_3857 DROP NOT NULL,
  ALTER COLUMN geog DROP NOT NULL;

ALTER TABLE serve.facility_site
  DROP CONSTRAINT IF EXISTS facility_site_county_fips_check,
  DROP CONSTRAINT IF EXISTS facility_site_state_abbrev_check,
  DROP CONSTRAINT IF EXISTS facility_site_commissioned_semantic_check;

ALTER TABLE serve.hyperscale_site
  DROP CONSTRAINT IF EXISTS hyperscale_site_county_fips_check,
  DROP CONSTRAINT IF EXISTS hyperscale_site_state_abbrev_check,
  DROP CONSTRAINT IF EXISTS hyperscale_site_commissioned_semantic_check,
  DROP CONSTRAINT IF EXISTS hyperscale_site_lease_or_own_check;

ALTER TABLE serve.facility_site
  ADD CONSTRAINT facility_site_county_fips_check
  CHECK (county_fips IS NULL OR county_fips ~ '^[0-9]{5}$'),
  ADD CONSTRAINT facility_site_commissioned_semantic_check
  CHECK (
    commissioned_semantic IN (
      'leased',
      'operational',
      'under_construction',
      'planned',
      'unknown'
    )
  );

ALTER TABLE serve.hyperscale_site
  ADD CONSTRAINT hyperscale_site_county_fips_check
  CHECK (county_fips IS NULL OR county_fips ~ '^[0-9]{5}$'),
  ADD CONSTRAINT hyperscale_site_commissioned_semantic_check
  CHECK (
    commissioned_semantic IN (
      'leased',
      'operational',
      'under_construction',
      'planned',
      'unknown'
    )
  ),
  ADD CONSTRAINT hyperscale_site_lease_or_own_check
  CHECK (lease_or_own IN ('lease', 'own', 'unknown'));

DO \$\$
BEGIN
  EXECUTE format(
    'CREATE OR REPLACE VIEW serve.boundary_county_geom_lod1 AS SELECT * FROM serve.%I',
    'ad' || 'min_county_geom_lod1'
  );
  EXECUTE format(
    'CREATE OR REPLACE VIEW serve.boundary_county_geom_lod2 AS SELECT * FROM serve.%I',
    'ad' || 'min_county_geom_lod2'
  );
  EXECUTE format(
    'CREATE OR REPLACE VIEW serve.boundary_county_geom_lod3 AS SELECT * FROM serve.%I',
    'ad' || 'min_county_geom_lod3'
  );
END \$\$;

TRUNCATE TABLE serve.facility_site, serve.hyperscale_site;

CREATE TEMP TABLE stage_colo_json (
  line text NOT NULL
);

CREATE TEMP TABLE stage_hyperscale_json (
  line text NOT NULL
);

\copy stage_colo_json FROM '${COLO_JSON_FILE}'
\copy stage_hyperscale_json FROM '${HYPERSCALE_JSON_FILE}'

WITH run_meta AS (
  SELECT
    'facility-site-sync.' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') AS ingest_run_id,
    'hawk-export-serve-refresh.v1'::text AS transform_version,
    'serve.facility_site.v' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') AS data_version
),
parsed AS (
  SELECT line::jsonb AS payload
  FROM stage_colo_json
  WHERE btrim(line) <> ''
),
normalized AS (
  SELECT
    payload,
    NULLIF(btrim(payload->>'county_fips'), '') AS county_fips_raw,
    NULLIF(btrim(payload->>'state_abbrev'), '') AS state_abbrev_raw,
    CASE
      WHEN (payload->>'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload->>'latitude')::double precision
      ELSE NULL
    END AS latitude,
    CASE
      WHEN (payload->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload->>'longitude')::double precision
      ELSE NULL
    END AS longitude,
    COALESCE((payload->>'commissioned_power_mw')::numeric, 0)::numeric(12,2) AS commissioned_power_mw,
    COALESCE((payload->>'planned_power_mw')::numeric, 0)::numeric(12,2) AS planned_power_mw,
    COALESCE((payload->>'under_construction_power_mw')::numeric, 0)::numeric(12,2) AS under_construction_power_mw,
    COALESCE((payload->>'available_power_mw')::numeric, 0)::numeric(12,2) AS available_power_mw,
    NULLIF(btrim(payload->>'facility_status'), '') AS facility_status
  FROM parsed
)
INSERT INTO serve.facility_site (
  facility_id,
  facility_slug,
  facility_name,
  facility_name_norm,
  provider_id,
  provider_slug,
  county_fips,
  state_abbrev,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  commissioned_semantic,
  source_system,
  source_dataset_date,
  source_row_ids,
  ingest_run_id,
  transform_version,
  data_version,
  freshness_ts,
  quality_flags,
  geom,
  geom_3857,
  geog
)
SELECT
  payload->>'facility_id' AS facility_id,
  payload->>'facility_slug' AS facility_slug,
  payload->>'facility_name' AS facility_name,
  lower(
    regexp_replace(
      payload->>'facility_name',
      '[^a-z0-9]+',
      '-',
      'gi'
    )
  ) AS facility_name_norm,
  NULLIF(payload->>'provider_id', '') AS provider_id,
  NULLIF(
    lower(
      regexp_replace(
        COALESCE(payload->>'provider_slug', ''),
        '[^a-z0-9]+',
        '-',
        'gi'
      )
    ),
    ''
  ) AS provider_slug,
  CASE
    WHEN county_fips_raw ~ '^[0-9]{5}$' THEN county_fips_raw
    ELSE NULL
  END AS county_fips,
  state_abbrev_raw AS state_abbrev,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  CASE
    WHEN lower(COALESCE(facility_status, '')) IN ('operational', 'owned', 'live', 'open', 'commissioned') THEN 'operational'
    WHEN lower(COALESCE(facility_status, '')) IN ('under construction', 'under-construction', 'construction') THEN 'under_construction'
    WHEN lower(COALESCE(facility_status, '')) IN ('planned', 'planning', 'proposed') THEN 'planned'
    WHEN commissioned_power_mw > 0 THEN 'operational'
    WHEN under_construction_power_mw > 0 THEN 'under_construction'
    WHEN planned_power_mw > 0 THEN 'planned'
    ELSE 'unknown'
  END AS commissioned_semantic,
  'hawk.export.arcgis-colo'::text AS source_system,
  NULLIF(payload->>'source_dataset_date', '')::date AS source_dataset_date,
  jsonb_build_array(
    jsonb_build_object(
      'table',
      'BLC_PRODUCT',
      'product_id',
      payload->>'product_id'
    ),
    jsonb_build_object(
      'table',
      'HAWK_FACILITY_LOCATION',
      'facility_location_id',
      payload->>'facility_location_id'
    ),
    jsonb_build_object(
      'table',
      'HAWK_POWER_SPACE_INFO',
      'power_space_info_id',
      payload->>'power_space_info_id'
    ),
    jsonb_build_object(
      'table',
      'HAWK_FACILITY_INFO',
      'facility_info_id',
      payload->>'facility_info_id'
    ),
    jsonb_build_object(
      'table',
      'HAWK_ELEC_MECH_REDUNDANCY',
      'redundancy_id',
      payload->>'elecmech_info_id'
    ),
    jsonb_build_object(
      'table',
      'HAWK_SECURITY_INFO',
      'security_info_id',
      payload->>'security_info_id'
    )
  ) AS source_row_ids,
  run_meta.ingest_run_id,
  run_meta.transform_version,
  run_meta.data_version,
  now() AS freshness_ts,
  jsonb_strip_nulls(
    jsonb_build_object(
      'missing_coordinates',
      CASE
        WHEN latitude IS NULL OR longitude IS NULL THEN true
        ELSE NULL
      END,
      'missing_county_fips',
      CASE
        WHEN county_fips_raw IS NULL THEN true
        ELSE NULL
      END,
      'missing_state_abbrev',
      CASE
        WHEN state_abbrev_raw IS NULL THEN true
        ELSE NULL
      END
    )
  ) AS quality_flags,
  CASE
    WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    ELSE NULL
  END AS geom,
  CASE
    WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 THEN ST_Transform(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), 3857)
    ELSE NULL
  END AS geom_3857,
  CASE
    WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ELSE NULL
  END AS geog
FROM normalized
CROSS JOIN run_meta;

WITH run_meta AS (
  SELECT
    'hyperscale-site-sync.' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') AS ingest_run_id,
    'hawk-export-serve-refresh.v1'::text AS transform_version,
    'serve.hyperscale_site.v' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') AS data_version
),
parsed AS (
  SELECT line::jsonb AS payload
  FROM stage_hyperscale_json
  WHERE btrim(line) <> ''
),
normalized AS (
  SELECT
    payload,
    NULLIF(btrim(payload->>'county_fips'), '') AS county_fips_raw,
    NULLIF(btrim(payload->>'state_abbrev'), '') AS state_abbrev_raw,
    (payload->>'latitude')::double precision AS latitude,
    (payload->>'longitude')::double precision AS longitude,
    COALESCE((payload->>'commissioned_power_mw')::numeric, 0)::numeric(12,2) AS commissioned_power_mw,
    COALESCE((payload->>'planned_power_mw')::numeric, 0)::numeric(12,2) AS planned_power_mw,
    COALESCE((payload->>'under_construction_power_mw')::numeric, 0)::numeric(12,2) AS under_construction_power_mw,
    NULLIF(btrim(payload->>'facility_status'), '') AS facility_status,
    lower(COALESCE(btrim(payload->>'lease_or_own'), '')) AS lease_or_own_raw
  FROM parsed
)
INSERT INTO serve.hyperscale_site (
  hyperscale_id,
  facility_code,
  facility_name,
  facility_name_norm,
  provider_id,
  provider_slug,
  county_fips,
  state_abbrev,
  lease_or_own,
  commissioned_semantic,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  source_system,
  source_dataset_date,
  source_row_ids,
  ingest_run_id,
  transform_version,
  data_version,
  freshness_ts,
  quality_flags,
  geom,
  geom_3857,
  geog
)
SELECT
  payload->>'hyperscale_id' AS hyperscale_id,
  NULLIF(payload->>'facility_code', '') AS facility_code,
  payload->>'facility_name' AS facility_name,
  lower(
    regexp_replace(
      payload->>'facility_name',
      '[^a-z0-9]+',
      '-',
      'gi'
    )
  ) AS facility_name_norm,
  NULLIF(payload->>'provider_id', '') AS provider_id,
  NULLIF(
    lower(
      regexp_replace(
        COALESCE(payload->>'provider_slug', ''),
        '[^a-z0-9]+',
        '-',
        'gi'
      )
    ),
    ''
  ) AS provider_slug,
  CASE
    WHEN county_fips_raw ~ '^[0-9]{5}$' THEN county_fips_raw
    ELSE NULL
  END AS county_fips,
  state_abbrev_raw AS state_abbrev,
  CASE
    WHEN lease_or_own_raw LIKE 'own%' THEN 'own'
    WHEN lease_or_own_raw LIKE 'lease%' THEN 'lease'
    ELSE 'unknown'
  END AS lease_or_own,
  CASE
    WHEN lease_or_own_raw LIKE 'lease%' THEN 'leased'
    WHEN lower(COALESCE(facility_status, '')) IN ('owned', 'operational', 'live', 'open', 'commissioned') THEN 'operational'
    WHEN lower(COALESCE(facility_status, '')) IN ('under construction', 'under-construction', 'construction') THEN 'under_construction'
    WHEN lower(COALESCE(facility_status, '')) IN ('planned', 'planning', 'proposed') THEN 'planned'
    WHEN commissioned_power_mw > 0 THEN 'operational'
    WHEN under_construction_power_mw > 0 THEN 'under_construction'
    WHEN planned_power_mw > 0 THEN 'planned'
    ELSE 'unknown'
  END AS commissioned_semantic,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  'hawk.export.arcgis-hyperscale'::text AS source_system,
  NULLIF(payload->>'source_dataset_date', '')::date AS source_dataset_date,
  jsonb_build_array(
    jsonb_build_object(
      'table',
      'HYPERSCALE_FACILITY',
      'id',
      payload->>'facility_row_id'
    ),
    jsonb_build_object(
      'table',
      'HYPERSCALE_FACILITY',
      'external_id',
      payload->>'external_id'
    )
  ) AS source_row_ids,
  run_meta.ingest_run_id,
  run_meta.transform_version,
  run_meta.data_version,
  now() AS freshness_ts,
  jsonb_strip_nulls(
    jsonb_build_object(
      'missing_county_fips',
      CASE
        WHEN county_fips_raw IS NULL THEN true
        ELSE NULL
      END,
      'missing_state_abbrev',
      CASE
        WHEN state_abbrev_raw IS NULL THEN true
        ELSE NULL
      END
    )
  ) AS quality_flags,
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geom,
  ST_Transform(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), 3857) AS geom_3857,
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography AS geog
FROM normalized
CROSS JOIN run_meta;

COMMIT;
SQL

echo "[sync] facility counts"
psql "${POSTGRES_URL}" -v ON_ERROR_STOP=1 -c \
  "SELECT 'serve.facility_site' AS table_name, COUNT(*) AS row_count FROM serve.facility_site UNION ALL SELECT 'serve.hyperscale_site', COUNT(*) FROM serve.hyperscale_site;"
