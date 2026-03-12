#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${ENVIRONMENTAL_FLOOD_DATABASE_URL:-${DATABASE_URL:-}}"
SOURCE_RUN_ID="${ENVIRONMENTAL_FLOOD_SOURCE_RUN_ID:-}"

quote_sql_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "${value}"
}

for bin in tippecanoe pmtiles; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ -n "${SOURCE_RUN_ID}" ]] && ! command -v psql >/dev/null 2>&1; then
  echo "[tiles] ERROR: missing dependency in PATH: psql" >&2
  exit 1
fi

RUN_ID="${1:-sample}"
DATASET="${ENVIRONMENTAL_FLOOD_TILE_DATASET:-environmental-flood}"
LAYER_NAME="${ENVIRONMENTAL_FLOOD_TILE_LAYER_NAME:-flood-hazard}"
SOURCE_FILE="${ENVIRONMENTAL_FLOOD_SOURCE_FILE:-${ROOT_DIR}/data/environmental/flood/flood-hazard.geojson}"
OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
MIN_Z="0"
MAX_Z="${ENVIRONMENTAL_FLOOD_MAX_ZOOM:-14}"
TMP_DIR="${ENVIRONMENTAL_FLOOD_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"
TIPPECANOE_THREADS="${ENVIRONMENTAL_FLOOD_TILE_THREADS:-7}"

if [[ -n "${ENVIRONMENTAL_FLOOD_MIN_ZOOM:-}" && "${ENVIRONMENTAL_FLOOD_MIN_ZOOM}" != "0" ]]; then
  echo "[tiles] ERROR: environmental flood tiles must keep min zoom fixed at 0 (got ${ENVIRONMENTAL_FLOOD_MIN_ZOOM})" >&2
  exit 1
fi

if [[ -z "${SOURCE_RUN_ID}" && ! -f "${SOURCE_FILE}" ]]; then
  echo "[tiles] ERROR: source file not found: ${SOURCE_FILE}" >&2
  exit 1
fi

if [[ -n "${SOURCE_RUN_ID}" && -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[tiles] ERROR: ENVIRONMENTAL_FLOOD_SOURCE_RUN_ID requires DATABASE_URL or ENVIRONMENTAL_FLOOD_DATABASE_URL" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}" "${TMP_DIR}"
rm -f "${PMTILES_PATH}"

echo "[tiles] building environmental flood PMTiles" >&2
echo "[tiles] dataset=${DATASET} layer=${LAYER_NAME} z=${MIN_Z}-${MAX_Z} threads=${TIPPECANOE_THREADS}" >&2

TIPPECANOE_ARGS=(
  --force
  --layer="${LAYER_NAME}"
  -Z "${MIN_Z}"
  -z "${MAX_Z}"
  --no-simplification-of-shared-nodes
  --simplify-only-low-zooms
  --include=FLD_ZONE
  --include=ZONE_SUBTY
  --include=SFHA_TF
  --include=DFIRM_ID
  --include=SOURCE_CIT
  --include=is_flood_100
  --include=is_flood_500
  --include=flood_band
  --include=legend_key
  --include=data_version
  --temporary-directory="${TMP_DIR}"
  --output="${PMTILES_PATH}"
)

if [[ -n "${SOURCE_RUN_ID}" ]]; then
  SOURCE_RUN_ID_SQL="$(quote_sql_literal "${SOURCE_RUN_ID}")"
  psql "${DATABASE_URL_VALUE}" \
    -v ON_ERROR_STOP=1 \
    -c "
COPY (
  SELECT json_build_object(
    'type', 'Feature',
    'properties', json_build_object(
      'FLD_ZONE', flood.fld_zone,
      'ZONE_SUBTY', flood.zone_subty,
      'SFHA_TF', flood.sfha_tf,
      'DFIRM_ID', flood.dfirm_id,
      'SOURCE_CIT', flood.source_cit,
      'is_flood_100', flood.is_flood_100,
      'is_flood_500', flood.is_flood_500,
      'flood_band', flood.flood_band,
      'legend_key', flood.legend_key,
      'data_version', flood.data_version
    ),
    'geometry', ST_AsGeoJSON(flood.geom)::json
  )::text
  FROM environmental_current.flood_hazard AS flood
  WHERE flood.run_id = ${SOURCE_RUN_ID_SQL}
  ORDER BY flood.feature_id
) TO STDOUT
" | TIPPECANOE_MAX_THREADS="${TIPPECANOE_THREADS}" \
    tippecanoe "${TIPPECANOE_ARGS[@]}" --read-parallel -P
else
  case "${SOURCE_FILE}" in
    *.geojsonl|*.geojsonseq|*.ndjson)
      TIPPECANOE_MAX_THREADS="${TIPPECANOE_THREADS}" \
        tippecanoe "${TIPPECANOE_ARGS[@]}" --read-parallel -P "${SOURCE_FILE}"
      ;;
    *)
      TIPPECANOE_MAX_THREADS="${TIPPECANOE_THREADS}" \
        tippecanoe "${TIPPECANOE_ARGS[@]}" "${SOURCE_FILE}"
      ;;
  esac
fi

ARCHIVE_MIN_Z="$(pmtiles show "${PMTILES_PATH}" | awk -F': ' '/min zoom/ {print $2; exit}')"
if [[ "${ARCHIVE_MIN_Z}" != "0" ]]; then
  echo "[tiles] ERROR: environmental flood archive must expose tiles from zoom 0; built archive reported min zoom ${ARCHIVE_MIN_Z}" >&2
  exit 1
fi

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
