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
DATASET="${ENVIRONMENTAL_FLOOD_TILE_DATASET:-environmental-flood}"
LAYER_NAME="${ENVIRONMENTAL_FLOOD_TILE_LAYER_NAME:-flood-hazard}"
SOURCE_FILE="${ENVIRONMENTAL_FLOOD_SOURCE_FILE:-${ROOT_DIR}/data/environmental/flood/flood-hazard.geojson}"
OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
MBTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.mbtiles"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
MIN_Z="${ENVIRONMENTAL_FLOOD_MIN_ZOOM:-0}"
MAX_Z="${ENVIRONMENTAL_FLOOD_MAX_ZOOM:-16}"
TMP_DIR="${ENVIRONMENTAL_FLOOD_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "[tiles] ERROR: source file not found: ${SOURCE_FILE}" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}" "${TMP_DIR}"
rm -f "${MBTILES_PATH}" "${PMTILES_PATH}"

echo "[tiles] building environmental flood PMTiles" >&2
echo "[tiles] dataset=${DATASET} layer=${LAYER_NAME} source=${SOURCE_FILE}" >&2

tippecanoe \
  --force \
  --layer="${LAYER_NAME}" \
  -Z "${MIN_Z}" \
  -z "${MAX_Z}" \
  --detect-shared-borders \
  --simplify-only-low-zooms \
  --include=FLD_ZONE \
  --include=ZONE_SUBTY \
  --include=SFHA_TF \
  --include=DFIRM_ID \
  --include=SOURCE_CIT \
  --include=is_flood_100 \
  --include=is_flood_500 \
  --include=flood_band \
  --include=legend_key \
  --include=data_version \
  --temporary-directory="${TMP_DIR}" \
  --output="${MBTILES_PATH}" \
  "${SOURCE_FILE}"

pmtiles convert "${MBTILES_PATH}" "${PMTILES_PATH}" --tmpdir="${TMP_DIR}"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
