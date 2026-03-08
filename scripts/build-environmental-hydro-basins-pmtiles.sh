#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for bin in tippecanoe pmtiles; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

RUN_ID="${1:-sample}"
DATASET="${ENVIRONMENTAL_HYDRO_TILE_DATASET:-environmental-hydro-basins}"
OUT_DIR="${ENVIRONMENTAL_HYDRO_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
SOURCE_ROOT="${ENVIRONMENTAL_HYDRO_SOURCE_ROOT:-${ROOT_DIR}/data/environmental/hydro-basins}"
MBTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.mbtiles"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
TMP_DIR="${ENVIRONMENTAL_HYDRO_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"

SOURCE_FILES=(
  "${SOURCE_ROOT}/huc4-line.geojson"
  "${SOURCE_ROOT}/huc4-label.geojson"
  "${SOURCE_ROOT}/huc6-line.geojson"
  "${SOURCE_ROOT}/huc6-label.geojson"
  "${SOURCE_ROOT}/huc8-line.geojson"
  "${SOURCE_ROOT}/huc8-label.geojson"
  "${SOURCE_ROOT}/huc10-line.geojson"
  "${SOURCE_ROOT}/huc10-label.geojson"
  "${SOURCE_ROOT}/huc12-line.geojson"
)

for source_file in "${SOURCE_FILES[@]}"; do
  if [[ ! -f "${source_file}" ]]; then
    echo "[tiles] ERROR: source file not found: ${source_file}" >&2
    exit 1
  fi
done

mkdir -p "${OUT_DIR}" "${TMP_DIR}"
rm -f "${MBTILES_PATH}" "${PMTILES_PATH}"

echo "[tiles] building environmental hydro basins PMTiles" >&2
echo "[tiles] dataset=${DATASET} source_root=${SOURCE_ROOT}" >&2

tippecanoe \
  --force \
  --temporary-directory="${TMP_DIR}" \
  --output="${MBTILES_PATH}" \
  -Z 5 \
  -z 12 \
  -L "huc4-line:${SOURCE_ROOT}/huc4-line.geojson" \
  -L "huc4-label:${SOURCE_ROOT}/huc4-label.geojson" \
  -L "huc6-line:${SOURCE_ROOT}/huc6-line.geojson" \
  -L "huc6-label:${SOURCE_ROOT}/huc6-label.geojson" \
  -L "huc8-line:${SOURCE_ROOT}/huc8-line.geojson" \
  -L "huc8-label:${SOURCE_ROOT}/huc8-label.geojson" \
  -L "huc10-line:${SOURCE_ROOT}/huc10-line.geojson" \
  -L "huc10-label:${SOURCE_ROOT}/huc10-label.geojson" \
  -L "huc12-line:${SOURCE_ROOT}/huc12-line.geojson"

pmtiles convert "${MBTILES_PATH}" "${PMTILES_PATH}" --tmpdir="${TMP_DIR}"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
