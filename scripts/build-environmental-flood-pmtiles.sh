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
MAX_Z="${ENVIRONMENTAL_FLOOD_MAX_ZOOM:-9}"
TMP_ROOT_DIR="${ENVIRONMENTAL_FLOOD_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"
TIPPECANOE_THREADS="${ENVIRONMENTAL_FLOOD_TILE_THREADS:-7}"
SUBDIVIDE_VERTICES="${ENVIRONMENTAL_FLOOD_SUBDIVIDE_VERTICES:-255}"

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

mkdir -p "${OUT_DIR}" "${TMP_ROOT_DIR}"
TMP_DIR="$(mktemp -d "${TMP_ROOT_DIR}/attempt.XXXXXX")"
REDUCED_SOURCE_FILE="${TMP_DIR}/flood-overlay.geojsonseq"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT
rm -f "${PMTILES_PATH}"

echo "[tiles] building environmental flood PMTiles" >&2
echo "[tiles] dataset=${DATASET} layer=${LAYER_NAME} z=${MIN_Z}-${MAX_Z} threads=${TIPPECANOE_THREADS}" >&2
echo "[tiles] build-mode=reduced-overlay subdivide=${SUBDIVIDE_VERTICES}" >&2

TIPPECANOE_ARGS=(
  --force
  --json-progress
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
  WITH flood_overlay_source AS (
    SELECT
      COALESCE(flood.dfirm_id, 'unknown') AS dfirm_id,
      flood.is_flood_100,
      flood.is_flood_500,
      flood.flood_band,
      flood.legend_key,
      flood.data_version,
      ST_CollectionExtract(ST_MakeValid(flood.geom_3857), 3) AS geom_3857
    FROM environmental_current.flood_hazard AS flood
    WHERE flood.run_id = ${SOURCE_RUN_ID_SQL}
      AND (flood.is_flood_100 OR flood.is_flood_500)
  ),
  flood_overlay_groups AS (
    SELECT
      source.dfirm_id,
      source.is_flood_100,
      source.is_flood_500,
      source.flood_band,
      source.legend_key,
      source.data_version,
      ST_CollectionExtract(ST_MakeValid(ST_UnaryUnion(ST_Collect(source.geom_3857))), 3) AS geom_3857
    FROM flood_overlay_source AS source
    WHERE NOT ST_IsEmpty(source.geom_3857)
    GROUP BY
      source.dfirm_id,
      source.is_flood_100,
      source.is_flood_500,
      source.flood_band,
      source.legend_key,
      source.data_version
  ),
  flood_overlay_parts AS (
    SELECT
      groups.dfirm_id,
      groups.is_flood_100,
      groups.is_flood_500,
      groups.flood_band,
      groups.legend_key,
      groups.data_version,
      dumped.geom AS geom_3857
    FROM flood_overlay_groups AS groups
    CROSS JOIN LATERAL ST_Dump(groups.geom_3857) AS dumped
  ),
  flood_overlay_subdivided AS (
    SELECT
      parts.dfirm_id,
      parts.is_flood_100,
      parts.is_flood_500,
      parts.flood_band,
      parts.legend_key,
      parts.data_version,
      ST_CollectionExtract(ST_MakeValid(subdivided.geom), 3) AS geom_3857
    FROM flood_overlay_parts AS parts
    CROSS JOIN LATERAL ST_Subdivide(parts.geom_3857, ${SUBDIVIDE_VERTICES}) AS subdivided(geom)
  )
  SELECT json_build_object(
    'type', 'Feature',
    'properties', json_build_object(
      'DFIRM_ID', NULLIF(dfirm_id, 'unknown'),
      'FLD_ZONE', CASE
        WHEN is_flood_100 THEN 'SFHA'
        WHEN is_flood_500 THEN '0.2 PCT'
        ELSE 'OTHER'
      END,
      'ZONE_SUBTY', NULL,
      'SFHA_TF', CASE WHEN is_flood_100 THEN 'T' ELSE 'F' END,
      'SOURCE_CIT', NULL,
      'is_flood_100', CASE WHEN is_flood_100 THEN 1 ELSE 0 END,
      'is_flood_500', CASE WHEN is_flood_500 THEN 1 ELSE 0 END,
      'flood_band', flood_band,
      'legend_key', legend_key,
      'data_version', data_version
    ),
    'geometry', ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::json
  )::text
  FROM flood_overlay_subdivided
  WHERE NOT ST_IsEmpty(geom_3857)
) TO STDOUT
" | {
  reduced_export_count=0
  while IFS= read -r line; do
    printf '%s\n' "${line}"
    reduced_export_count=$((reduced_export_count + 1))
    if (( reduced_export_count % 5000 == 0 )); then
      printf '[tiles] reduced-export-count=%s\n' "${reduced_export_count}" >&2
    fi
  done
  printf '[tiles] reduced-export-count=%s\n' "${reduced_export_count}" >&2
} > "${REDUCED_SOURCE_FILE}"

  REDUCED_FEATURE_COUNT="$(wc -l < "${REDUCED_SOURCE_FILE}" | tr -d '[:space:]')"
  echo "[tiles] reduced overlay exported: ${REDUCED_SOURCE_FILE}" >&2
  echo "[tiles] reduced-feature-count=${REDUCED_FEATURE_COUNT}" >&2
  TIPPECANOE_MAX_THREADS="${TIPPECANOE_THREADS}" \
    tippecanoe "${TIPPECANOE_ARGS[@]}" --read-parallel -P "${REDUCED_SOURCE_FILE}"
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
