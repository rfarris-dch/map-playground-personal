#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_latest_run_id() {
  python3 - "${ROOT_DIR}/var/environmental-sync/environmental-hydro-basins/latest.json" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception:
    raise SystemExit(0)

run_id = payload.get("runId")
if isinstance(run_id, str) and run_id.strip():
    print(run_id.strip())
PY
}

for bin in bash; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

RUN_ID="${1:-${RUN_ID:-sample}}"
if [[ "${RUN_ID}" == "sample" ]]; then
  LATEST_RUN_ID="$(resolve_latest_run_id)"
  if [[ -n "${LATEST_RUN_ID}" ]]; then
    RUN_ID="${LATEST_RUN_ID}"
  fi
fi

DATASET="${ENVIRONMENTAL_HYDRO_TILE_DATASET:-environmental-hydro-basins}"
OUT_DIR="${ENVIRONMENTAL_HYDRO_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
SOURCE_ROOT="${ENVIRONMENTAL_HYDRO_SOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-hydro-basins/${RUN_ID}}"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
MIN_Z="${ENVIRONMENTAL_HYDRO_MIN_ZOOM:-5}"
MAX_Z="${ENVIRONMENTAL_HYDRO_MAX_ZOOM:-12}"
PLANETILER_THREADS="${ENVIRONMENTAL_HYDRO_TILE_THREADS:-4}"
PLANETILER_SCHEMA_PATH="${ROOT_DIR}/config/planetiler/environmental-hydro-basins.yml"

SOURCE_FILES=(
  "${SOURCE_ROOT}/huc4-polygon.geojson"
  "${SOURCE_ROOT}/huc4-line.geojson"
  "${SOURCE_ROOT}/huc4-label.geojson"
  "${SOURCE_ROOT}/huc6-polygon.geojson"
  "${SOURCE_ROOT}/huc6-line.geojson"
  "${SOURCE_ROOT}/huc6-label.geojson"
  "${SOURCE_ROOT}/huc8-polygon.geojson"
  "${SOURCE_ROOT}/huc8-line.geojson"
  "${SOURCE_ROOT}/huc8-label.geojson"
  "${SOURCE_ROOT}/huc10-polygon.geojson"
  "${SOURCE_ROOT}/huc10-line.geojson"
  "${SOURCE_ROOT}/huc10-label.geojson"
  "${SOURCE_ROOT}/huc12-polygon.geojson"
  "${SOURCE_ROOT}/huc12-line.geojson"
)

for source_file in "${SOURCE_FILES[@]}"; do
  if [[ ! -f "${source_file}" ]]; then
    echo "[tiles] ERROR: source file not found: ${source_file}" >&2
    exit 1
  fi
done

mkdir -p "${OUT_DIR}"

echo "[tiles] building environmental hydro basins PMTiles with Planetiler" >&2
echo "[tiles] dataset=${DATASET} source_root=${SOURCE_ROOT} z=${MIN_Z}-${MAX_Z} threads=${PLANETILER_THREADS}" >&2

bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_PATH}" \
  "${PMTILES_PATH}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${MAX_Z}" \
  "--threads=${PLANETILER_THREADS}" \
  "--huc4_polygon=${SOURCE_ROOT}/huc4-polygon.geojson" \
  "--huc4_line=${SOURCE_ROOT}/huc4-line.geojson" \
  "--huc4_label=${SOURCE_ROOT}/huc4-label.geojson" \
  "--huc6_polygon=${SOURCE_ROOT}/huc6-polygon.geojson" \
  "--huc6_line=${SOURCE_ROOT}/huc6-line.geojson" \
  "--huc6_label=${SOURCE_ROOT}/huc6-label.geojson" \
  "--huc8_polygon=${SOURCE_ROOT}/huc8-polygon.geojson" \
  "--huc8_line=${SOURCE_ROOT}/huc8-line.geojson" \
  "--huc8_label=${SOURCE_ROOT}/huc8-label.geojson" \
  "--huc10_polygon=${SOURCE_ROOT}/huc10-polygon.geojson" \
  "--huc10_line=${SOURCE_ROOT}/huc10-line.geojson" \
  "--huc10_label=${SOURCE_ROOT}/huc10-label.geojson" \
  "--huc12_polygon=${SOURCE_ROOT}/huc12-polygon.geojson" \
  "--huc12_line=${SOURCE_ROOT}/huc12-line.geojson"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
