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

DCH_OS_REPO="${DCH_OS_REPO:-${HOME}/dev/dch-os}"
MIRROR_LOAD_SCRIPT="${DCH_OS_REPO}/apps/api/src/scripts/mirror-load.ts"
SPATIAL_BUILD_SQL="${DCH_OS_REPO}/scripts/postgis-build-spatial-schema.sql"
LOCK_ROOT="${HYPERSCALE_SYNC_LOCK_ROOT:-${ROOT_DIR}/var/sync-locks}"
SYNC_LOCK_DIR="${LOCK_ROOT}/hyperscale.lock"
SYNC_LOCK_PID_FILE="${SYNC_LOCK_DIR}/pid"

acquire_sync_lock() {
  mkdir -p "${LOCK_ROOT}"

  if mkdir "${SYNC_LOCK_DIR}" 2>/dev/null; then
    printf '%s\n' "$$" > "${SYNC_LOCK_PID_FILE}"
    return
  fi

  local lock_pid
  lock_pid="$(cat "${SYNC_LOCK_PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${lock_pid}" ]] && ! kill -0 "${lock_pid}" 2>/dev/null; then
    rm -rf "${SYNC_LOCK_DIR}"
    if mkdir "${SYNC_LOCK_DIR}" 2>/dev/null; then
      printf '%s\n' "$$" > "${SYNC_LOCK_PID_FILE}"
      return
    fi
  fi

  echo "[sync] hyperscale-sync lock already held (${SYNC_LOCK_DIR})" >&2
  exit 16
}

release_sync_lock() {
  if [[ -d "${SYNC_LOCK_DIR}" ]]; then
    rm -rf "${SYNC_LOCK_DIR}" || true
  fi
}

on_exit() {
  release_sync_lock
}

trap on_exit EXIT

acquire_sync_lock

if [[ ! -f "${MIRROR_LOAD_SCRIPT}" ]]; then
  echo "error: mirror loader not found at ${MIRROR_LOAD_SCRIPT}" >&2
  exit 1
fi

if [[ ! -f "${SPATIAL_BUILD_SQL}" ]]; then
  echo "error: spatial build SQL not found at ${SPATIAL_BUILD_SQL}" >&2
  exit 1
fi

echo "[sync] mirror hyperscale tables from mysql -> postgres"
(
  cd "${DCH_OS_REPO}"
  MIRROR_TABLES=HYPERSCALE_FACILITY,HYPERSCALE_PROVIDER,HYPERSCALE_HISTORICAL_CAPACITY \
    bun run apps/api/src/scripts/mirror-load.ts
)

echo "[sync] rebuild spatial schema from mirror"
psql "${POSTGRES_URL}" -v ON_ERROR_STOP=1 -f "${SPATIAL_BUILD_SQL}" >/dev/null

echo "[sync] refresh serve.hyperscale_site"
psql "${POSTGRES_URL}" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
BEGIN;

ALTER TABLE serve.hyperscale_site
  DROP CONSTRAINT IF EXISTS hyperscale_site_commissioned_semantic_check;
ALTER TABLE serve.hyperscale_site
  ADD CONSTRAINT hyperscale_site_commissioned_semantic_check
  CHECK (
    commissioned_semantic IN (
      'leased',
      'operational',
      'under_construction',
      'planned',
      'unknown'
    )
  );

ALTER TABLE serve.facility_site
  DROP CONSTRAINT IF EXISTS facility_site_commissioned_semantic_check;
ALTER TABLE serve.facility_site
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

TRUNCATE TABLE serve.hyperscale_site;

WITH run_meta AS (
  SELECT
    'mirror-sync-hyperscale.' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') AS ingest_run_id,
    'hyperscale-site-builder.v1'::text AS transform_version,
    'serve.hyperscale_site.v' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') AS data_version,
    (SELECT MAX("DATE_UPDATED")::date FROM mirror."HYPERSCALE_FACILITY") AS source_dataset_date
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
  trim(f.id) AS hyperscale_id,
  NULLIF(trim(f.facility_code), '') AS facility_code,
  COALESCE(NULLIF(trim(f.company), ''), 'Hyperscale ' || trim(f.id)) AS facility_name,
  lower(regexp_replace(COALESCE(NULLIF(trim(f.company), ''), 'Hyperscale ' || trim(f.id)), '[^a-z0-9]+', '-', 'g')) AS facility_name_norm,
  CASE WHEN f.provider_id IS NULL THEN NULL ELSE f.provider_id::text END AS provider_id,
  NULLIF(
    lower(
      regexp_replace(
        regexp_replace(COALESCE(NULLIF(trim(p."SHORT_NAME"), ''), NULLIF(trim(p."NAME"), ''), ''), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)',
        '',
        'g'
      )
    ),
    ''
  ) AS provider_slug,
  trim(f.county_fips) AS county_fips,
  upper(trim(f.state)) AS state_abbrev,
  CASE
    WHEN lower(COALESCE(trim(f.lease_or_own), '')) LIKE 'own%' THEN 'own'
    WHEN lower(COALESCE(trim(f.lease_or_own), '')) LIKE 'lease%' THEN 'lease'
    ELSE 'unknown'
  END AS lease_or_own,
  CASE
    WHEN lower(COALESCE(trim(f.lease_or_own), '')) LIKE 'lease%' THEN 'leased'
    WHEN lower(COALESCE(trim(f.facility_status), '')) IN ('owned', 'operational', 'live', 'open', 'commissioned') THEN 'operational'
    WHEN lower(COALESCE(trim(f.facility_status), '')) IN ('under construction', 'under-construction', 'construction') THEN 'under_construction'
    WHEN lower(COALESCE(trim(f.facility_status), '')) IN ('planned', 'planning', 'proposed') THEN 'planned'
    WHEN COALESCE(f.commissioned_power_kw, 0) > 0 THEN 'operational'
    WHEN COALESCE(f.uc_power_kw, 0) > 0 THEN 'under_construction'
    WHEN COALESCE(f.planned_power_kw, 0) > 0 THEN 'planned'
    ELSE 'unknown'
  END AS commissioned_semantic,
  round(COALESCE(f.commissioned_power_kw, 0)::numeric, 2) AS commissioned_power_mw,
  round(COALESCE(f.planned_power_kw, 0)::numeric, 2) AS planned_power_mw,
  round(COALESCE(f.uc_power_kw, 0)::numeric, 2) AS under_construction_power_mw,
  'legacy.hawk_hyperscale'::text AS source_system,
  run_meta.source_dataset_date,
  jsonb_build_array(
    jsonb_build_object(
      'table',
      'HYPERSCALE_FACILITY',
      'id',
      trim(f.id)
    )
  ) AS source_row_ids,
  run_meta.ingest_run_id,
  run_meta.transform_version,
  run_meta.data_version,
  now() AS freshness_ts,
  '{}'::jsonb AS quality_flags,
  f.geom,
  f.geom_3857,
  f.geog
FROM spatial.hyperscale_facility_features AS f
LEFT JOIN mirror."HYPERSCALE_PROVIDER" AS p
  ON p."ID" = f.provider_id
CROSS JOIN run_meta
WHERE trim(f.id) <> ''
  AND upper(trim(COALESCE(f.state, ''))) ~ '^[A-Z]{2}$'
  AND trim(COALESCE(f.county_fips, '')) ~ '^[0-9]{5}$';

COMMIT;
SQL

echo "[sync] update mirror_sync_meta checkpoints"
psql "${POSTGRES_URL}" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
WITH facility_stats AS (
  SELECT
    COUNT(*)::bigint AS row_count,
    MAX("DATE_UPDATED") AS max_cursor_ts
  FROM mirror."HYPERSCALE_FACILITY"
),
provider_stats AS (
  SELECT
    COUNT(*)::bigint AS row_count,
    MAX("DATE_UPDATED") AS max_cursor_ts
  FROM mirror."HYPERSCALE_PROVIDER"
),
history_stats AS (
  SELECT
    COUNT(*)::bigint AS row_count,
    MAX("ID")::bigint AS max_cursor_bigint
  FROM mirror."HYPERSCALE_HISTORICAL_CAPACITY"
),
sync_rows AS (
  SELECT
    'HYPERSCALE_FACILITY'::text AS table_name,
    'DATE_UPDATED'::text AS cursor_column,
    'timestamp'::text AS cursor_kind,
    facility_stats.max_cursor_ts AS last_cursor_ts,
    NULL::bigint AS last_cursor_bigint,
    facility_stats.max_cursor_ts AS source_max_cursor_ts,
    NULL::bigint AS source_max_cursor_bigint,
    facility_stats.row_count AS source_est_rows,
    facility_stats.row_count AS mirror_est_rows,
    facility_stats.row_count AS last_rows_fetched,
    facility_stats.row_count AS last_rows_upserted
  FROM facility_stats
  UNION ALL
  SELECT
    'HYPERSCALE_PROVIDER'::text AS table_name,
    'DATE_UPDATED'::text AS cursor_column,
    'timestamp'::text AS cursor_kind,
    provider_stats.max_cursor_ts AS last_cursor_ts,
    NULL::bigint AS last_cursor_bigint,
    provider_stats.max_cursor_ts AS source_max_cursor_ts,
    NULL::bigint AS source_max_cursor_bigint,
    provider_stats.row_count AS source_est_rows,
    provider_stats.row_count AS mirror_est_rows,
    provider_stats.row_count AS last_rows_fetched,
    provider_stats.row_count AS last_rows_upserted
  FROM provider_stats
  UNION ALL
  SELECT
    'HYPERSCALE_HISTORICAL_CAPACITY'::text AS table_name,
    'ID'::text AS cursor_column,
    'bigint'::text AS cursor_kind,
    NULL::timestamp AS last_cursor_ts,
    history_stats.max_cursor_bigint AS last_cursor_bigint,
    NULL::timestamp AS source_max_cursor_ts,
    history_stats.max_cursor_bigint AS source_max_cursor_bigint,
    history_stats.row_count AS source_est_rows,
    history_stats.row_count AS mirror_est_rows,
    history_stats.row_count AS last_rows_fetched,
    history_stats.row_count AS last_rows_upserted
  FROM history_stats
)
INSERT INTO mirror.mirror_sync_meta (
  table_name,
  cursor_column,
  cursor_kind,
  last_started_at,
  last_finished_at,
  last_success_at,
  last_cursor_ts,
  last_cursor_bigint,
  source_max_cursor_ts,
  source_max_cursor_bigint,
  lag_seconds,
  source_est_rows,
  mirror_est_rows,
  last_rows_fetched,
  last_rows_upserted,
  last_error,
  updated_at
)
SELECT
  table_name,
  cursor_column,
  cursor_kind,
  now(),
  now(),
  now(),
  last_cursor_ts,
  last_cursor_bigint,
  source_max_cursor_ts,
  source_max_cursor_bigint,
  0,
  source_est_rows,
  mirror_est_rows,
  last_rows_fetched,
  last_rows_upserted,
  NULL::text,
  now()
FROM sync_rows
ON CONFLICT (table_name) DO UPDATE
SET
  cursor_column = EXCLUDED.cursor_column,
  cursor_kind = EXCLUDED.cursor_kind,
  last_started_at = EXCLUDED.last_started_at,
  last_finished_at = EXCLUDED.last_finished_at,
  last_success_at = EXCLUDED.last_success_at,
  last_cursor_ts = EXCLUDED.last_cursor_ts,
  last_cursor_bigint = EXCLUDED.last_cursor_bigint,
  source_max_cursor_ts = EXCLUDED.source_max_cursor_ts,
  source_max_cursor_bigint = EXCLUDED.source_max_cursor_bigint,
  lag_seconds = EXCLUDED.lag_seconds,
  source_est_rows = EXCLUDED.source_est_rows,
  mirror_est_rows = EXCLUDED.mirror_est_rows,
  last_rows_fetched = EXCLUDED.last_rows_fetched,
  last_rows_upserted = EXCLUDED.last_rows_upserted,
  last_error = NULL,
  updated_at = now();
SQL

echo "[verify] mysql vs pg mirror vs serve"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e \
  "SELECT 'mysql.HYPERSCALE_FACILITY', COUNT(*) FROM HYPERSCALE_FACILITY UNION ALL SELECT 'mysql.HYPERSCALE_PROVIDER', COUNT(*) FROM HYPERSCALE_PROVIDER UNION ALL SELECT 'mysql.HYPERSCALE_HISTORICAL_CAPACITY', COUNT(*) FROM HYPERSCALE_HISTORICAL_CAPACITY;"

psql "${POSTGRES_URL}" -At -F $'\t' -c \
  "SELECT 'pg.mirror.HYPERSCALE_FACILITY', COUNT(*) FROM mirror.\"HYPERSCALE_FACILITY\" UNION ALL SELECT 'pg.mirror.HYPERSCALE_PROVIDER', COUNT(*) FROM mirror.\"HYPERSCALE_PROVIDER\" UNION ALL SELECT 'pg.mirror.HYPERSCALE_HISTORICAL_CAPACITY', COUNT(*) FROM mirror.\"HYPERSCALE_HISTORICAL_CAPACITY\" UNION ALL SELECT 'pg.spatial.hyperscale_facility_features', COUNT(*) FROM spatial.hyperscale_facility_features UNION ALL SELECT 'pg.serve.hyperscale_site', COUNT(*) FROM serve.hyperscale_site;"

echo "[done] hyperscale refresh complete"
