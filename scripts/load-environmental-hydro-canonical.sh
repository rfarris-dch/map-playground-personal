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
SNAPSHOT_ROOT="${ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT:-${ROOT_DIR}/var/environmental-sync/environmental-hydro-basins}"
RUN_DIR="${SNAPSHOT_ROOT}/${RUN_ID}"
NORMALIZED_ROOT="${ENVIRONMENTAL_HYDRO_NORMALIZED_ROOT:-${RUN_DIR}/normalized}"
SCHEMA_SQL="${ROOT_DIR}/scripts/sql/environmental-hydro-schema.sql"
STAGE_TABLE_FQN="environmental_build.hydro_feature_stage"

if [[ -z "${DB_URL}" ]]; then
  echo "[hydro] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[hydro] ERROR: run id is required" >&2
  exit 1
fi

for bin in psql python3; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[hydro] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"

RUN_CONFIG_PATH="${RUN_DIR}/run-config.json"
if [[ ! -f "${RUN_CONFIG_PATH}" ]]; then
  echo "[hydro] ERROR: missing run config: ${RUN_CONFIG_PATH}" >&2
  exit 1
fi

read_run_config_field() {
  local field="$1"
  python3 - "${RUN_CONFIG_PATH}" "${field}" <<'PY'
import json
import sys

path, field = sys.argv[1:3]
with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

value = payload.get(field)
if isinstance(value, str):
    print(value)
PY
}

DATA_VERSION="$(read_run_config_field "dataVersion")"
SOURCE_PATH="$(read_run_config_field "sourcePath")"
SOURCE_URL="$(read_run_config_field "sourceUrl")"

quote_sql_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "${value}"
}

RUN_ID_SQL="$(quote_sql_literal "${RUN_ID}")"
DATA_VERSION_SQL="$(quote_sql_literal "${DATA_VERSION:-${RUN_ID}}")"
SOURCE_PATH_SQL="$(quote_sql_literal "${SOURCE_PATH}")"
SOURCE_URL_SQL="$(quote_sql_literal "${SOURCE_URL}")"

psql "${DB_URL}" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO environmental_meta.hydro_runs (
  run_id,
  data_version,
  source_path,
  source_url,
  started_at,
  completed_at,
  status,
  notes
)
VALUES (
  ${RUN_ID_SQL},
  ${DATA_VERSION_SQL},
  NULLIF(${SOURCE_PATH_SQL}, ''),
  NULLIF(${SOURCE_URL_SQL}, ''),
  now(),
  NULL,
  'loading',
  '{}'::jsonb
)
ON CONFLICT (run_id) DO UPDATE
SET
  data_version = EXCLUDED.data_version,
  source_path = EXCLUDED.source_path,
  source_url = EXCLUDED.source_url,
  status = EXCLUDED.status;
SQL

psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "DELETE FROM ${STAGE_TABLE_FQN} WHERE run_id = ${RUN_ID_SQL};"

load_feature_file() {
  local feature_kind="$1"
  local huc_level="$2"
  local source_file="$3"

  if [[ ! -f "${source_file}" ]]; then
    return 0
  fi

  echo "[hydro] staging ${feature_kind} huc${huc_level} from ${source_file}" >&2
  python3 - "${RUN_ID}" "${feature_kind}" "${huc_level}" "${source_file}" <<'PY' |
import json
import sys

run_id, feature_kind, huc_level, path = sys.argv[1:5]
with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

features = payload.get("features")
if not isinstance(features, list):
    raise SystemExit(0)

for feature in features:
    print("\t".join([run_id, feature_kind, huc_level, json.dumps(feature, separators=(",", ":"))]))
PY
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "\copy ${STAGE_TABLE_FQN}(run_id, feature_kind, huc_level, raw_json) FROM STDIN WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\b', ESCAPE E'\b')"
}

for level in 4 6 8 10 12; do
  load_feature_file "polygon" "${level}" "${NORMALIZED_ROOT}/huc${level}-polygon.geojson"
  load_feature_file "line" "${level}" "${NORMALIZED_ROOT}/huc${level}-line.geojson"
  if [[ "${level}" != "12" ]]; then
    load_feature_file "label" "${level}" "${NORMALIZED_ROOT}/huc${level}-label.geojson"
  fi
done

psql "${DB_URL}" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

TRUNCATE TABLE environmental_current.hydro_huc_polygons RESTART IDENTITY;
TRUNCATE TABLE environmental_current.hydro_huc_lines RESTART IDENTITY;
TRUNCATE TABLE environmental_current.hydro_huc_labels RESTART IDENTITY;

INSERT INTO environmental_current.hydro_huc_polygons (
  run_id,
  huc_level,
  huc,
  name,
  areasqkm,
  states,
  data_version,
  geom,
  geom_3857
)
SELECT
  ${RUN_ID_SQL},
  stage.huc_level,
  NULLIF(stage.raw_json->'properties'->>'huc', ''),
  NULLIF(stage.raw_json->'properties'->>'name', ''),
  NULLIF(stage.raw_json->'properties'->>'areasqkm', '')::double precision,
  NULLIF(stage.raw_json->'properties'->>'states', ''),
  COALESCE(NULLIF(stage.raw_json->'properties'->>'data_version', ''), ${DATA_VERSION_SQL}),
  ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON((stage.raw_json->'geometry')::text), 4326)),
  ST_Transform(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON((stage.raw_json->'geometry')::text), 4326)), 3857)
FROM ${STAGE_TABLE_FQN} AS stage
WHERE stage.run_id = ${RUN_ID_SQL}
  AND stage.feature_kind = 'polygon';

INSERT INTO environmental_current.hydro_huc_lines (
  run_id,
  huc_level,
  data_version,
  geom,
  geom_3857
)
SELECT
  ${RUN_ID_SQL},
  stage.huc_level,
  COALESCE(NULLIF(stage.raw_json->'properties'->>'data_version', ''), ${DATA_VERSION_SQL}),
  ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON((stage.raw_json->'geometry')::text), 4326)),
  ST_Transform(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON((stage.raw_json->'geometry')::text), 4326)), 3857)
FROM ${STAGE_TABLE_FQN} AS stage
WHERE stage.run_id = ${RUN_ID_SQL}
  AND stage.feature_kind = 'line';

INSERT INTO environmental_current.hydro_huc_labels (
  run_id,
  huc_level,
  huc,
  name,
  areasqkm,
  label_rank,
  states,
  data_version,
  geom,
  geom_3857
)
SELECT
  ${RUN_ID_SQL},
  stage.huc_level,
  NULLIF(stage.raw_json->'properties'->>'huc', ''),
  NULLIF(stage.raw_json->'properties'->>'name', ''),
  NULLIF(stage.raw_json->'properties'->>'areasqkm', '')::double precision,
  NULLIF(stage.raw_json->'properties'->>'label_rank', '')::double precision,
  NULLIF(stage.raw_json->'properties'->>'states', ''),
  COALESCE(NULLIF(stage.raw_json->'properties'->>'data_version', ''), ${DATA_VERSION_SQL}),
  ST_SetSRID(ST_GeomFromGeoJSON((stage.raw_json->'geometry')::text), 4326),
  ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON((stage.raw_json->'geometry')::text), 4326), 3857)
FROM ${STAGE_TABLE_FQN} AS stage
WHERE stage.run_id = ${RUN_ID_SQL}
  AND stage.feature_kind = 'label';

ANALYZE environmental_current.hydro_huc_polygons;
ANALYZE environmental_current.hydro_huc_lines;
ANALYZE environmental_current.hydro_huc_labels;

UPDATE environmental_meta.hydro_runs
SET
  completed_at = now(),
  status = 'completed'
WHERE run_id = ${RUN_ID_SQL};

COMMIT;
SQL

echo "[hydro] canonical load complete runId=${RUN_ID}" >&2
