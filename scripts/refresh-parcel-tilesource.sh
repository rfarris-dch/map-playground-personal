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

if [[ -z "${DB_URL}" ]]; then
  echo "[tilesource] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[tilesource] ERROR: missing dependency in PATH: psql" >&2
  exit 1
fi

echo "[tilesource] refreshing parcel_tiles.parcels_draw_source" >&2

psql "${DB_URL}" \
  -v ON_ERROR_STOP=1 \
  -v run_id="${RUN_ID}" \
  -c "
BEGIN;
TRUNCATE TABLE parcel_tiles.parcels_draw_source;
INSERT INTO parcel_tiles.parcels_draw_source (
  parcel_id,
  ingestion_run_id,
  attrs,
  geom,
  geom_3857
)
SELECT
  parcel_id,
  ingestion_run_id,
  attrs,
  geom,
  geom_3857
FROM parcel_current.parcels;
ANALYZE parcel_tiles.parcels_draw_source;
COMMIT;
"

if [[ -n "${RUN_ID}" ]]; then
  psql "${DB_URL}" \
    -v ON_ERROR_STOP=1 \
    -At \
    -v run_id="${RUN_ID}" \
    -c "
SELECT count(*)
FROM parcel_tiles.parcels_draw_source
WHERE ingestion_run_id = :'run_id';
"
else
  psql "${DB_URL}" \
    -v ON_ERROR_STOP=1 \
    -At \
    -c "
SELECT count(*)
FROM parcel_tiles.parcels_draw_source;
"
fi
