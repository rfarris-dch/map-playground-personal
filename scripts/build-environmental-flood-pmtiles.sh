#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${ENVIRONMENTAL_FLOOD_DATABASE_URL:-${DATABASE_URL:-}}"
RUN_ID="${1:-}"

quote_sql_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "${value}"
}

resolve_latest_run_id() {
  psql "${DATABASE_URL_VALUE}" \
    -v ON_ERROR_STOP=1 \
    -At \
    -c "
SELECT run_id
FROM environmental_meta.flood_runs
WHERE status = 'completed'
ORDER BY completed_at DESC NULLS LAST, started_at DESC, run_id DESC
LIMIT 1;
"
}

for bin in psql bash; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[tiles] ERROR: DATABASE_URL or ENVIRONMENTAL_FLOOD_DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(resolve_latest_run_id)"
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[tiles] ERROR: unable to resolve flood run id" >&2
  exit 1
fi

DATASET="${ENVIRONMENTAL_FLOOD_TILE_DATASET:-environmental-flood}"
OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
MIN_Z="0"
MAX_Z="${ENVIRONMENTAL_FLOOD_MAX_ZOOM:-9}"
PLANETILER_THREADS="${ENVIRONMENTAL_FLOOD_TILE_THREADS:-7}"
TMP_ROOT_DIR="${ENVIRONMENTAL_FLOOD_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"
PLANETILER_SCHEMA_PATH="${ROOT_DIR}/config/planetiler/environmental-flood.yml"

if [[ -n "${ENVIRONMENTAL_FLOOD_MIN_ZOOM:-}" && "${ENVIRONMENTAL_FLOOD_MIN_ZOOM}" != "0" ]]; then
  echo "[tiles] ERROR: environmental flood tiles must keep min zoom fixed at 0 (got ${ENVIRONMENTAL_FLOOD_MIN_ZOOM})" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}" "${TMP_ROOT_DIR}"
TMP_DIR="$(mktemp -d "${TMP_ROOT_DIR}/attempt.XXXXXX")"
REDUCED_SOURCE_FILE="${TMP_DIR}/flood-overlay.geojsonl"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

echo "[tiles] building environmental flood PMTiles with Planetiler" >&2
echo "[tiles] dataset=${DATASET} runId=${RUN_ID} z=${MIN_Z}-${MAX_Z} threads=${PLANETILER_THREADS}" >&2
echo "[tiles] build-mode=planetiler tables=environmental_tiles.flood_overlay_100,environmental_tiles.flood_overlay_500" >&2

RUN_ID_SQL="$(quote_sql_literal "${RUN_ID}")"
psql "${DATABASE_URL_VALUE}" \
  -v ON_ERROR_STOP=1 \
  -c "
COPY (
  SELECT json_build_object(
    'type', 'Feature',
    'properties', json_build_object(
      'FLD_ZONE', 'SFHA',
      'ZONE_SUBTY', NULL,
      'SFHA_TF', 'T',
      'SOURCE_CIT', NULL,
      'is_flood_100', 1,
      'is_flood_500', 0,
      'flood_band', flood_band,
      'legend_key', legend_key,
      'data_version', data_version
    ),
    'geometry', ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::json
  )::text
  FROM environmental_tiles.flood_overlay_100
  WHERE run_id = ${RUN_ID_SQL}
  UNION ALL
  SELECT json_build_object(
    'type', 'Feature',
    'properties', json_build_object(
      'FLD_ZONE', '0.2 PCT',
      'ZONE_SUBTY', NULL,
      'SFHA_TF', 'F',
      'SOURCE_CIT', NULL,
      'is_flood_100', 0,
      'is_flood_500', 1,
      'flood_band', flood_band,
      'legend_key', legend_key,
      'data_version', data_version
    ),
    'geometry', ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::json
  )::text
  FROM environmental_tiles.flood_overlay_500
  WHERE run_id = ${RUN_ID_SQL}
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

bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_PATH}" \
  "${PMTILES_PATH}" \
  "--input_path=${REDUCED_SOURCE_FILE}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${MAX_Z}" \
  "--threads=${PLANETILER_THREADS}"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
