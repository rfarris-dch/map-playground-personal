#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "[tiles] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

for bin in psql tippecanoe pmtiles jq; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

RUN_ID="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"
DATASET="${PARCELS_TILE_DATASET:-parcels-draw-v1}"
LAYER_NAME="${PARCELS_TILE_LAYER_NAME:-parcels}"
PROFILE="${PARCELS_TILES_PROFILE:-thin}"
MIN_Z="${PARCELS_TILES_MIN_ZOOM:-0}"
if [[ "${PROFILE}" == "thin" ]]; then
  MAX_Z_DEFAULT="${PARCELS_TILES_THIN_DEFAULT_MAX_ZOOM:-15}"
else
  MAX_Z_DEFAULT="16"
fi
MAX_Z="${PARCELS_TILES_MAX_ZOOM:-${MAX_Z_DEFAULT}}"
GEOJSON_MAX_DIGITS="${PARCELS_TILES_GEOJSON_MAX_DIGITS:-6}"
MAX_TILE_BYTES="${PARCELS_TILES_MAX_TILE_BYTES:-2000000}"
OUT_DIR="${PARCELS_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
SNAPSHOT_ROOT="${PARCEL_SYNC_OUTPUT_DIR:-${ROOT_DIR}/var/parcels-sync}"
SCHEMA_FILE_DEFAULT="${SNAPSHOT_ROOT}/${RUN_ID}/layer-metadata.json"
SCHEMA_FILE="${PARCELS_TILE_SCHEMA_FILE:-${SCHEMA_FILE_DEFAULT}}"
TIPPECANOE_TMP_DIR="${PARCELS_TILES_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"
PMTILES_TMP_DIR="${PARCELS_PMTILES_TMP_DIR:-${TIPPECANOE_TMP_DIR}}"
PMTILES_NO_DEDUPLICATION="${PARCELS_PMTILES_NO_DEDUPLICATION:-0}"
STAGE_GEOJSON_FILE="${PARCELS_TILES_STAGE_GEOJSON_FILE:-1}"
KEEP_STAGED_GEOJSON_FILE="${PARCELS_TILES_KEEP_STAGED_GEOJSON_FILE:-1}"
REUSE_GEOJSON_FILE="${PARCELS_TILES_REUSE_GEOJSON_FILE:-1}"
DETECT_SHARED_BORDERS="${PARCELS_TILES_DETECT_SHARED_BORDERS:-0}"
BUILD_RETRY_ATTEMPTS="${PARCELS_TILES_BUILD_RETRY_ATTEMPTS:-5}"
BUILD_RETRY_DELAY_SECONDS="${PARCELS_TILES_BUILD_RETRY_DELAY_SECONDS:-8}"
CONVERT_RETRY_ATTEMPTS="${PARCELS_PMTILES_CONVERT_RETRY_ATTEMPTS:-3}"
CONVERT_RETRY_DELAY_SECONDS="${PARCELS_PMTILES_CONVERT_RETRY_DELAY_SECONDS:-5}"

mkdir -p "${OUT_DIR}" "${TIPPECANOE_TMP_DIR}" "${PMTILES_TMP_DIR}"

MBTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.mbtiles"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
SCHEMA_OUTPUT_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.tile-schema.json"
GEOJSONL_PATH="${PARCELS_TILES_GEOJSONL_PATH:-${OUT_DIR}/${DATASET}_${RUN_ID}.geojsonl}"
GEOJSONL_TMP_PATH="${GEOJSONL_PATH}.tmp-${RUN_ID}-$$"
BUILD_LOCK_DIR="${OUT_DIR}/${DATASET}_${RUN_ID}.build.lock"
BUILD_LOCK_PID_FILE="${BUILD_LOCK_DIR}/pid"

acquire_build_lock() {
  if mkdir "${BUILD_LOCK_DIR}" 2>/dev/null; then
    printf '%s\n' "$$" > "${BUILD_LOCK_PID_FILE}"
    return 0
  fi

  if [[ -f "${BUILD_LOCK_PID_FILE}" ]]; then
    lock_pid="$(cat "${BUILD_LOCK_PID_FILE}" 2>/dev/null || true)"
    if [[ -n "${lock_pid}" ]] && ! kill -0 "${lock_pid}" 2>/dev/null; then
      rm -rf "${BUILD_LOCK_DIR}" 2>/dev/null || true
      if mkdir "${BUILD_LOCK_DIR}" 2>/dev/null; then
        printf '%s\n' "$$" > "${BUILD_LOCK_PID_FILE}"
        return 0
      fi
    fi
  fi

  echo "[tiles] ERROR: build lock already held for runId=${RUN_ID} (${BUILD_LOCK_DIR})" >&2
  return 1
}

acquire_build_lock

echo "[tiles] building MBTiles from parcel_current.parcels" >&2
echo "[tiles] dataset=${DATASET} layer=${LAYER_NAME} profile=${PROFILE} z=${MIN_Z}-${MAX_Z}" >&2
echo "[tiles] stage_geojson_file=${STAGE_GEOJSON_FILE} reuse_geojson_file=${REUSE_GEOJSON_FILE} detect_shared_borders=${DETECT_SHARED_BORDERS}" >&2
echo "[tiles] build_retries=${BUILD_RETRY_ATTEMPTS} convert_retries=${CONVERT_RETRY_ATTEMPTS}" >&2

TIPPECANOE_INCLUDE_ARGS=(--exclude-all --include=pid)
TIPPECANOE_LIMIT_ARGS=(--maximum-tile-bytes="${MAX_TILE_BYTES}" --drop-densest-as-needed --extend-zooms-if-still-dropping)
FIELDS_JSON='["pid"]'
PROPERTIES_SQL="jsonb_build_object('pid', parcel_id::text)"

if [[ "${PROFILE}" == "full_170" ]]; then
  if [[ ! -f "${SCHEMA_FILE}" ]]; then
    echo "[tiles] ERROR: missing schema metadata file for full_170 profile: ${SCHEMA_FILE}" >&2
    echo "[tiles]        set PARCELS_TILE_SCHEMA_FILE=/absolute/path/to/layer-metadata.json" >&2
    exit 1
  fi

  mapfile -t SCHEMA_FIELDS < <(
    jq -r '.fields[]?.name | select(type == "string" and length > 0)' "${SCHEMA_FILE}" | LC_ALL=C sort -u
  )
  if [[ "${#SCHEMA_FIELDS[@]}" -eq 0 ]]; then
    echo "[tiles] ERROR: schema metadata contains no fields: ${SCHEMA_FILE}" >&2
    exit 1
  fi

  for FIELD_NAME in "${SCHEMA_FIELDS[@]}"; do
    if [[ "${FIELD_NAME}" == "pid" ]]; then
      continue
    fi
    TIPPECANOE_INCLUDE_ARGS+=("--include=${FIELD_NAME}")
  done

  FIELDS_JSON="$(jq -c '["pid"] + ([.fields[]?.name | select(type == "string" and length > 0)] | unique | sort)' "${SCHEMA_FILE}")"
  PROPERTIES_SQL="jsonb_build_object('pid', parcel_id::text) || COALESCE(attrs, '{}'::jsonb)"
  TIPPECANOE_LIMIT_ARGS=(--no-feature-limit --no-tile-size-limit)
fi

if [[ "${PROFILE}" != "full_170" && "${PROFILE}" != "thin" ]]; then
  echo "[tiles] ERROR: unsupported PARCELS_TILES_PROFILE=${PROFILE}. Expected full_170 or thin." >&2
  exit 1
fi

TIPPECANOE_COMMON_ARGS=(
  --force
  --layer="${LAYER_NAME}"
  -Z "${MIN_Z}"
  -z "${MAX_Z}"
  --simplify-only-low-zooms
  --temporary-directory="${TIPPECANOE_TMP_DIR}"
  "${TIPPECANOE_LIMIT_ARGS[@]}"
  "${TIPPECANOE_INCLUDE_ARGS[@]}"
)

if [[ "${DETECT_SHARED_BORDERS}" == "1" ]]; then
  TIPPECANOE_COMMON_ARGS+=(--detect-shared-borders)
fi

jq -n \
  --arg dataset "${DATASET}" \
  --arg layer "${LAYER_NAME}" \
  --arg profile "${PROFILE}" \
  --arg runId "${RUN_ID}" \
  --arg schemaFile "${SCHEMA_FILE}" \
  --argjson fields "${FIELDS_JSON}" \
  '{
    dataset: $dataset,
    layer: $layer,
    profile: $profile,
    runId: $runId,
    schemaFile: $schemaFile,
    fieldCount: ($fields | length),
    fields: $fields
  }' > "${SCHEMA_OUTPUT_PATH}"

echo "[tiles] schema snapshot: ${SCHEMA_OUTPUT_PATH}" >&2

SQL=$(cat <<EOF
SELECT jsonb_build_object(
  'type', 'Feature',
  'geometry', ST_AsGeoJSON(geom, ${GEOJSON_MAX_DIGITS})::jsonb,
  'properties', ${PROPERTIES_SQL}
)::text
FROM parcel_current.parcels;
EOF
)

cleanup() {
  rm -rf "${BUILD_LOCK_DIR}" 2>/dev/null || true
  rm -f "${GEOJSONL_TMP_PATH}"
  if [[ "${STAGE_GEOJSON_FILE}" == "1" && "${KEEP_STAGED_GEOJSON_FILE}" != "1" ]]; then
    rm -f "${GEOJSONL_PATH}"
  fi
}
trap cleanup EXIT

prepare_geojsonl_if_needed() {
  if [[ "${STAGE_GEOJSON_FILE}" != "1" ]]; then
    return 0
  fi

  if [[ "${REUSE_GEOJSON_FILE}" == "1" && -s "${GEOJSONL_PATH}" ]]; then
    echo "[tiles] reusing staged GeoJSONL: ${GEOJSONL_PATH}" >&2
    return 0
  fi

  echo "[tiles] exporting GeoJSONL to ${GEOJSONL_PATH}" >&2
  rm -f "${GEOJSONL_TMP_PATH}"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -X -q -A -t -c "${SQL}" > "${GEOJSONL_TMP_PATH}"
  mv -f "${GEOJSONL_TMP_PATH}" "${GEOJSONL_PATH}"
}

run_tippecanoe_attempt() {
  local output_path="$1"
  if [[ "${STAGE_GEOJSON_FILE}" == "1" ]]; then
    tippecanoe "${TIPPECANOE_COMMON_ARGS[@]}" --output="${output_path}" -P "${GEOJSONL_PATH}"
    return 0
  fi

  psql "${DB_URL}" -v ON_ERROR_STOP=1 -X -q -A -t -c "${SQL}" |
    tippecanoe "${TIPPECANOE_COMMON_ARGS[@]}" --output="${output_path}" --read-parallel
}

build_mbtiles_with_retries() {
  local attempt
  local attempt_output
  for ((attempt = 1; attempt <= BUILD_RETRY_ATTEMPTS; attempt += 1)); do
    attempt_output="${MBTILES_PATH}.attempt-${attempt}"
    rm -f "${attempt_output}"
    echo "[tiles] build attempt ${attempt}/${BUILD_RETRY_ATTEMPTS}" >&2

    if run_tippecanoe_attempt "${attempt_output}"; then
      mv -f "${attempt_output}" "${MBTILES_PATH}"
      return 0
    fi

    rm -f "${attempt_output}"
    if (( attempt < BUILD_RETRY_ATTEMPTS )); then
      echo "[tiles] build attempt ${attempt} failed, retrying in ${BUILD_RETRY_DELAY_SECONDS}s" >&2
      sleep "${BUILD_RETRY_DELAY_SECONDS}"
    fi
  done

  echo "[tiles] ERROR: failed to build MBTiles after ${BUILD_RETRY_ATTEMPTS} attempts" >&2
  return 1
}

convert_pmtiles_with_retries() {
  local attempt
  local attempt_output
  local convert_args
  convert_args=(--tmpdir="${PMTILES_TMP_DIR}")
  if [[ "${PMTILES_NO_DEDUPLICATION}" == "1" ]]; then
    convert_args+=(--no-deduplication)
  fi

  for ((attempt = 1; attempt <= CONVERT_RETRY_ATTEMPTS; attempt += 1)); do
    attempt_output="${PMTILES_PATH}.attempt-${attempt}"
    rm -f "${attempt_output}"
    echo "[tiles] pmtiles convert attempt ${attempt}/${CONVERT_RETRY_ATTEMPTS}" >&2

    if pmtiles convert "${MBTILES_PATH}" "${attempt_output}" "${convert_args[@]}"; then
      mv -f "${attempt_output}" "${PMTILES_PATH}"
      return 0
    fi

    rm -f "${attempt_output}"
    if (( attempt < CONVERT_RETRY_ATTEMPTS )); then
      echo "[tiles] convert attempt ${attempt} failed, retrying in ${CONVERT_RETRY_DELAY_SECONDS}s" >&2
      sleep "${CONVERT_RETRY_DELAY_SECONDS}"
    fi
  done

  echo "[tiles] ERROR: failed to convert PMTiles after ${CONVERT_RETRY_ATTEMPTS} attempts" >&2
  return 1
}

prepare_geojsonl_if_needed
build_mbtiles_with_retries

echo "[tiles] converting MBTiles -> PMTiles" >&2
convert_pmtiles_with_retries

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
