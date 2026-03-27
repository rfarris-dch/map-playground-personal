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
if not isinstance(run_id, str) or not run_id.strip():
    current = payload.get("current")
    if isinstance(current, dict):
        candidate = current.get("ingestionRunId")
        if isinstance(candidate, str) and candidate.strip():
            run_id = candidate
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
  "${SOURCE_ROOT}/huc4-polygon.geojsonl"
  "${SOURCE_ROOT}/huc4-line.geojsonl"
  "${SOURCE_ROOT}/huc4-label.geojsonl"
  "${SOURCE_ROOT}/huc6-polygon.geojsonl"
  "${SOURCE_ROOT}/huc6-line.geojsonl"
  "${SOURCE_ROOT}/huc6-label.geojsonl"
  "${SOURCE_ROOT}/huc8-polygon.geojsonl"
  "${SOURCE_ROOT}/huc8-line.geojsonl"
  "${SOURCE_ROOT}/huc8-label.geojsonl"
  "${SOURCE_ROOT}/huc10-polygon.geojsonl"
  "${SOURCE_ROOT}/huc10-line.geojsonl"
  "${SOURCE_ROOT}/huc10-label.geojsonl"
  "${SOURCE_ROOT}/huc12-polygon.geojsonl"
  "${SOURCE_ROOT}/huc12-line.geojsonl"
)

for source_file in "${SOURCE_FILES[@]}"; do
  if [[ ! -f "${source_file}" ]]; then
    echo "[tiles] ERROR: source file not found: ${source_file}" >&2
    exit 1
  fi
done

mkdir -p "${OUT_DIR}"

echo "[tiles] building environmental hydro basins PMTiles with Planetiler" >&2
echo "[tiles] dataset=${DATASET} source_root=${SOURCE_ROOT} handoff=canonical-geoparquet z=${MIN_Z}-${MAX_Z} threads=${PLANETILER_THREADS}" >&2

bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_PATH}" \
  "${PMTILES_PATH}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${MAX_Z}" \
  "--threads=${PLANETILER_THREADS}" \
  "--huc4_polygon=${SOURCE_ROOT}/huc4-polygon.geojsonl" \
  "--huc4_line=${SOURCE_ROOT}/huc4-line.geojsonl" \
  "--huc4_label=${SOURCE_ROOT}/huc4-label.geojsonl" \
  "--huc6_polygon=${SOURCE_ROOT}/huc6-polygon.geojsonl" \
  "--huc6_line=${SOURCE_ROOT}/huc6-line.geojsonl" \
  "--huc6_label=${SOURCE_ROOT}/huc6-label.geojsonl" \
  "--huc8_polygon=${SOURCE_ROOT}/huc8-polygon.geojsonl" \
  "--huc8_line=${SOURCE_ROOT}/huc8-line.geojsonl" \
  "--huc8_label=${SOURCE_ROOT}/huc8-label.geojsonl" \
  "--huc10_polygon=${SOURCE_ROOT}/huc10-polygon.geojsonl" \
  "--huc10_line=${SOURCE_ROOT}/huc10-line.geojsonl" \
  "--huc10_label=${SOURCE_ROOT}/huc10-label.geojsonl" \
  "--huc12_polygon=${SOURCE_ROOT}/huc12-polygon.geojsonl" \
  "--huc12_line=${SOURCE_ROOT}/huc12-line.geojsonl"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
