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
RUN_ID="${1:-${RUN_ID:-}}"
TARGET_ROOT="${ENVIRONMENTAL_HYDRO_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-hydro-basins/${RUN_ID}}"

quote_sql_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "${value}"
}

resolve_latest_run_id() {
  psql "${DB_URL}" \
    -v ON_ERROR_STOP=1 \
    -At \
    -c "
SELECT run_id
FROM environmental_meta.hydro_runs
WHERE status = 'completed'
ORDER BY completed_at DESC NULLS LAST, started_at DESC, run_id DESC
LIMIT 1;
"
}

if [[ -z "${DB_URL}" ]]; then
  echo "[tilesource] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[tilesource] ERROR: missing dependency in PATH: psql" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(resolve_latest_run_id)"
  TARGET_ROOT="${ENVIRONMENTAL_HYDRO_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-hydro-basins/${RUN_ID}}"
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[tilesource] ERROR: run id is required" >&2
  exit 1
fi

RUN_ID_SQL="$(quote_sql_literal "${RUN_ID}")"

mkdir -p "${TARGET_ROOT}"
rm -f "${TARGET_ROOT}"/*.geojson

echo "[tilesource] refreshing hydro tilesource tables for runId=${RUN_ID}" >&2

psql "${DB_URL}" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

TRUNCATE TABLE environmental_tiles.hydro_polygon_source RESTART IDENTITY;
TRUNCATE TABLE environmental_tiles.hydro_line_source RESTART IDENTITY;
TRUNCATE TABLE environmental_tiles.hydro_label_source RESTART IDENTITY;

INSERT INTO environmental_tiles.hydro_polygon_source (
  run_id,
  huc_level,
  huc,
  name,
  areasqkm,
  states,
  data_version,
  geom_3857
)
SELECT
  run_id,
  huc_level,
  huc,
  name,
  areasqkm,
  states,
  data_version,
  geom_3857
FROM environmental_current.hydro_huc_polygons
WHERE run_id = ${RUN_ID_SQL};

INSERT INTO environmental_tiles.hydro_line_source (
  run_id,
  huc_level,
  data_version,
  geom_3857
)
SELECT
  run_id,
  huc_level,
  data_version,
  geom_3857
FROM environmental_current.hydro_huc_lines
WHERE run_id = ${RUN_ID_SQL};

INSERT INTO environmental_tiles.hydro_label_source (
  run_id,
  huc_level,
  huc,
  name,
  areasqkm,
  label_rank,
  states,
  data_version,
  geom_3857
)
SELECT
  run_id,
  huc_level,
  huc,
  name,
  areasqkm,
  label_rank,
  states,
  data_version,
  geom_3857
FROM environmental_current.hydro_huc_labels
WHERE run_id = ${RUN_ID_SQL};

ANALYZE environmental_tiles.hydro_polygon_source;
ANALYZE environmental_tiles.hydro_line_source;
ANALYZE environmental_tiles.hydro_label_source;

COMMIT;
SQL

export_feature_collection() {
  local output_path="$1"
  local query="$2"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -At -c "${query}" > "${output_path}"
}

for level in 4 6 8 10 12; do
  export_feature_collection \
    "${TARGET_ROOT}/huc${level}-polygon.geojson" \
    "
WITH features AS (
  SELECT jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'huc', huc,
      'name', name,
      'areasqkm', areasqkm,
      'states', states,
      'data_version', data_version
    ),
    'geometry', ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::jsonb
  ) AS feature
  FROM environmental_tiles.hydro_polygon_source
  WHERE run_id = ${RUN_ID_SQL}
    AND huc_level = ${level}
)
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
)::text
FROM features;
"

  export_feature_collection \
    "${TARGET_ROOT}/huc${level}-line.geojson" \
    "
WITH features AS (
  SELECT jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'huc_level', CONCAT('huc', huc_level),
      'data_version', data_version
    ),
    'geometry', ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::jsonb
  ) AS feature
  FROM environmental_tiles.hydro_line_source
  WHERE run_id = ${RUN_ID_SQL}
    AND huc_level = ${level}
)
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
)::text
FROM features;
"

  if [[ "${level}" != "12" ]]; then
    export_feature_collection \
      "${TARGET_ROOT}/huc${level}-label.geojson" \
      "
WITH features AS (
  SELECT jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'name', name,
      'huc', huc,
      'areasqkm', areasqkm,
      'label_rank', label_rank,
      'states', states,
      'data_version', data_version
    ),
    'geometry', ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::jsonb
  ) AS feature
  FROM environmental_tiles.hydro_label_source
  WHERE run_id = ${RUN_ID_SQL}
    AND huc_level = ${level}
)
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
)::text
FROM features;
"
  fi
done

echo "[tilesource] hydro tilesource export complete target_root=${TARGET_ROOT}" >&2
