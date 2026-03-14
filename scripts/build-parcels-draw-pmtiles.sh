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

for bin in psql jq bash; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

RUN_ID="${1:-${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}}"
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
PLANETILER_THREADS="${PARCELS_TILE_THREADS:-4}"
GEOJSON_MAX_DIGITS="${PARCELS_TILES_GEOJSON_MAX_DIGITS:-6}"
OUT_DIR="${PARCELS_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
SNAPSHOT_ROOT="${PARCEL_SYNC_OUTPUT_DIR:-${ROOT_DIR}/var/parcels-sync}"
SCHEMA_FILE_DEFAULT="${SNAPSHOT_ROOT}/${RUN_ID}/layer-metadata.json"
SCHEMA_FILE="${PARCELS_TILE_SCHEMA_FILE:-${SCHEMA_FILE_DEFAULT}}"
STAGE_GEOJSON_FILE="${PARCELS_TILES_STAGE_GEOJSON_FILE:-1}"
KEEP_STAGED_GEOJSON_FILE="${PARCELS_TILES_KEEP_STAGED_GEOJSON_FILE:-1}"
REUSE_GEOJSON_FILE="${PARCELS_TILES_REUSE_GEOJSON_FILE:-1}"
PLANETILER_SCHEMA_TMP_DIR="${PARCELS_TILES_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"

mkdir -p "${OUT_DIR}" "${PLANETILER_SCHEMA_TMP_DIR}"

PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
SCHEMA_OUTPUT_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.tile-schema.json"
GEOJSONL_PATH="${PARCELS_TILES_GEOJSONL_PATH:-${OUT_DIR}/${DATASET}_${RUN_ID}.geojsonl}"
GEOJSONL_TMP_PATH="${GEOJSONL_PATH}.tmp-${RUN_ID}-$$"
PLANETILER_SCHEMA_RUNTIME_PATH="${PLANETILER_SCHEMA_TMP_DIR}/${DATASET}_${RUN_ID}.planetiler.yml"
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

TIPPECANOE_FIELDS=(pid ll_gisacre zoning_type fema_flood_zone landval parval taxamt struct ll_bldg_count ll_bldg_footprint_sqft transmission_line_distance population_density zoning_subtype fema_flood_zone_subtype)
FIELDS_JSON='["pid","ll_gisacre","zoning_type","fema_flood_zone","landval","parval","taxamt","struct","ll_bldg_count","ll_bldg_footprint_sqft","transmission_line_distance","population_density","zoning_subtype","fema_flood_zone_subtype"]'
PROPERTIES_SQL="jsonb_build_object('pid', parcel_id::text) || jsonb_build_object('ll_gisacre', (attrs->>'ll_gisacre')::numeric, 'zoning_type', attrs->>'zoning_type', 'fema_flood_zone', attrs->>'fema_flood_zone', 'landval', (attrs->>'landval')::numeric, 'parval', (attrs->>'parval')::numeric, 'taxamt', (attrs->>'taxamt')::numeric, 'struct', attrs->>'struct', 'll_bldg_count', (attrs->>'ll_bldg_count')::int, 'll_bldg_footprint_sqft', (attrs->>'ll_bldg_footprint_sqft')::numeric, 'transmission_line_distance', (attrs->>'transmission_line_distance')::numeric, 'population_density', (attrs->>'population_density')::numeric, 'zoning_subtype', attrs->>'zoning_subtype', 'fema_flood_zone_subtype', attrs->>'fema_flood_zone_subtype')"

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

  TIPPECANOE_FIELDS=(pid "${SCHEMA_FIELDS[@]}")
  FIELDS_JSON="$(jq -c '["pid"] + ([.fields[]?.name | select(type == "string" and length > 0)] | unique | sort)' "${SCHEMA_FILE}")"
  PROPERTIES_SQL="jsonb_build_object('pid', parcel_id::text) || COALESCE(attrs, '{}'::jsonb)"
fi

if [[ "${PROFILE}" != "full_170" && "${PROFILE}" != "thin" ]]; then
  echo "[tiles] ERROR: unsupported PARCELS_TILES_PROFILE=${PROFILE}. Expected full_170 or thin." >&2
  exit 1
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
COPY (
  SELECT jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(geom, ${GEOJSON_MAX_DIGITS})::jsonb,
    'properties', ${PROPERTIES_SQL}
  )::text
  FROM parcel_tiles.parcels_draw_source
) TO STDOUT;
EOF
)

cleanup() {
  rm -rf "${BUILD_LOCK_DIR}" 2>/dev/null || true
  rm -f "${GEOJSONL_TMP_PATH}"
  rm -f "${PLANETILER_SCHEMA_RUNTIME_PATH}"
  if [[ "${STAGE_GEOJSON_FILE}" == "1" && "${KEEP_STAGED_GEOJSON_FILE}" != "1" ]]; then
    rm -f "${GEOJSONL_PATH}"
  fi
}
trap cleanup EXIT

prepare_geojsonl_if_needed() {
  if [[ "${STAGE_GEOJSON_FILE}" != "1" ]]; then
    echo "[tiles] ERROR: Planetiler parcel builds require staged GeoJSONL input" >&2
    exit 1
  fi

  if [[ "${REUSE_GEOJSON_FILE}" == "1" && -s "${GEOJSONL_PATH}" ]]; then
    echo "[tiles] reusing staged GeoJSONL: ${GEOJSONL_PATH}" >&2
    return 0
  fi

  echo "[tiles] exporting GeoJSONL to ${GEOJSONL_PATH}" >&2
  rm -f "${GEOJSONL_TMP_PATH}"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -X -q -c "${SQL}" > "${GEOJSONL_TMP_PATH}"
  mv -f "${GEOJSONL_TMP_PATH}" "${GEOJSONL_PATH}"
}

write_planetiler_schema() {
  {
    printf 'schema_name: Parcels Draw\n'
    printf 'schema_description: Parcel tiles built from parcel_tiles.parcels_draw_source.\n\n'
    printf 'sources:\n'
    printf '  parcels:\n'
    printf '    type: geojson\n'
    printf "    local_path: '\${ args.input_path }'\n\n"
    printf 'layers:\n'
    printf '  - id: %s\n' "${LAYER_NAME}"
    printf '    features:\n'
    printf '      - source: parcels\n'
    printf '        geometry: polygon\n'
    printf '        attributes:\n'
    for field_name in "${TIPPECANOE_FIELDS[@]}"; do
      printf '          - key: %s\n' "${field_name}"
      printf '            tag_value: %s\n' "${field_name}"
    done
  } > "${PLANETILER_SCHEMA_RUNTIME_PATH}"
}

prepare_geojsonl_if_needed
write_planetiler_schema

echo "[tiles] building parcel PMTiles with Planetiler" >&2
echo "[tiles] dataset=${DATASET} layer=${LAYER_NAME} profile=${PROFILE} z=${MIN_Z}-${MAX_Z} threads=${PLANETILER_THREADS}" >&2

bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_RUNTIME_PATH}" \
  "${PMTILES_PATH}" \
  "--input_path=${GEOJSONL_PATH}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${MAX_Z}" \
  "--threads=${PLANETILER_THREADS}"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
