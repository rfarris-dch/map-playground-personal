#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

: "${ARCGIS_PARCEL_CLIENT_ID:?ARCGIS_PARCEL_CLIENT_ID must be set}"
: "${ARCGIS_PARCEL_CLIENT_SECRET:?ARCGIS_PARCEL_CLIENT_SECRET must be set}"

RUN_ID="${RUN_ID:-}"
RUN_ID_EXPLICIT=0
if [[ -n "${RUN_ID}" ]]; then
  RUN_ID_EXPLICIT=1
fi
SNAPSHOT_ROOT="${PARCEL_SYNC_OUTPUT_DIR:-${ROOT_DIR}/var/parcels-sync}"
PUBLISH_ROOT="${PARCELS_PUBLISH_ROOT:-${ROOT_DIR}/apps/web/public}"
ACTIVE_STATUS_PATH="${SNAPSHOT_ROOT}/active-run.json"
STATUS_HEARTBEAT_PID=""

write_active_status() {
  local phase="$1"
  local is_running="$2"
  local summary="${3:-__none__}"
  python3 - "${ACTIVE_STATUS_PATH}" "${RUN_ID}" "${phase}" "${is_running}" "${summary}" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, run_id, phase, is_running, summary = sys.argv[1:6]
payload = {
    "runId": run_id,
    "phase": phase,
    "isRunning": is_running == "1",
    "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "summary": None if summary == "__none__" else summary,
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY
}

start_status_heartbeat() {
  local phase="$1"
  local summary="${2:-__none__}"
  local interval_seconds="${3:-5}"

  (
    while true; do
      write_active_status "${phase}" "1" "${summary}"
      sleep "${interval_seconds}"
    done
  ) &
  echo "$!"
}

stop_status_heartbeat() {
  local heartbeat_pid="$1"
  if [[ -z "${heartbeat_pid}" ]]; then
    return
  fi

  if kill -0 "${heartbeat_pid}" 2>/dev/null; then
    kill "${heartbeat_pid}" 2>/dev/null || true
    wait "${heartbeat_pid}" 2>/dev/null || true
  fi
}

on_exit() {
  local code=$?
  stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
  if [[ ${code} -ne 0 ]]; then
    write_active_status "failed" "0" "exit_code=${code}"
  fi
}

trap on_exit EXIT

find_resumable_run_id() {
  local root="$1"
  local run_dir
  local stat_entries=()
  local sorted_entries

  shopt -s nullglob
  for run_dir in "${root}"/*/; do
    [[ -d "${run_dir}" ]] || continue
    stat_entries+=("$(stat -f %m "${run_dir}" 2>/dev/null || printf '0')|${run_dir%/}")
  done
  shopt -u nullglob

  if [[ ${#stat_entries[@]} -eq 0 ]]; then
    return 1
  fi

  mapfile -t sorted_entries < <(printf '%s\n' "${stat_entries[@]}" | sort -t '|' -k1,1nr)
  for run_dir in "${sorted_entries[@]}"; do
    run_dir="${run_dir#*|}"
    if [[ -f "${run_dir}/run-summary.json" ]]; then
      continue
    fi

    if ls "${run_dir}"/state-*.checkpoint.json >/dev/null 2>&1; then
      basename "${run_dir}"
      return 0
    fi
  done

  return 1
}

EXTRACT_ARGS=()
for ARG in "$@"; do
  case "$ARG" in
    --run-id=*|--runId=*)
      RUN_ID="${ARG#*=}"
      RUN_ID_EXPLICIT=1
      ;;
    *)
      EXTRACT_ARGS+=("$ARG")
      ;;
  esac
done

mkdir -p "${SNAPSHOT_ROOT}"

if [[ "${PARCEL_SYNC_RESUME:-1}" == "1" && ${RUN_ID_EXPLICIT} -eq 0 ]]; then
  RESUMABLE_RUN_ID="$(find_resumable_run_id "${SNAPSHOT_ROOT}" || true)"
  if [[ -n "${RESUMABLE_RUN_ID}" ]]; then
    RUN_ID="${RESUMABLE_RUN_ID}"
    echo "[parcels] resume mode detected existing in-progress runId=${RUN_ID}"
  fi
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
fi

echo "[parcels] refresh start runId=${RUN_ID}"
echo "[parcels] snapshot root=${SNAPSHOT_ROOT}"
echo "[parcels] publish root=${PUBLISH_ROOT}"
write_active_status "extracting" "1"

EXTRACT_CMD=(
  bun
  run
  "${ROOT_DIR}/scripts/refresh-parcels.ts"
  "--output-dir=${SNAPSHOT_ROOT}"
  "--run-id=${RUN_ID}"
)

if [[ "${PARCEL_SYNC_RESUME:-1}" == "1" ]]; then
  EXTRACT_CMD+=("--resume")
fi

EXTRACT_CMD+=("${EXTRACT_ARGS[@]}")

echo "[parcels] extracting snapshot from ArcGIS/Regrid"
echo "[parcels] extract cmd: ${EXTRACT_CMD[*]}"
"${EXTRACT_CMD[@]}"

RUN_DIR="${SNAPSHOT_ROOT}/${RUN_ID}"
if [[ ! -d "${RUN_DIR}" ]]; then
  echo "[parcels] ERROR: expected run directory not found: ${RUN_DIR}" >&2
  exit 1
fi

echo "[parcels] loading canonical table and swapping current snapshot"
write_active_status "loading" "1"
ACTIVE_STATUS_PATH="${ACTIVE_STATUS_PATH}" \
  bash "${ROOT_DIR}/scripts/load-parcels-canonical.sh" "${RUN_DIR}" "${RUN_ID}"

echo "[parcels] building parcels draw PMTiles"
write_active_status "building" "1"
# Faster tile-build defaults for nationwide runs.
: "${PARCELS_TILES_STAGE_GEOJSON_FILE:=1}"
: "${PARCELS_TILES_REUSE_GEOJSON_FILE:=1}"
: "${PARCELS_TILES_KEEP_STAGED_GEOJSON_FILE:=1}"
: "${PARCELS_TILES_DETECT_SHARED_BORDERS:=0}"
: "${PARCELS_TILES_MIN_ZOOM:=0}"
: "${PARCELS_TILES_THIN_DEFAULT_MAX_ZOOM:=15}"
: "${PARCELS_TILES_BUILD_RETRY_ATTEMPTS:=5}"
: "${PARCELS_TILES_BUILD_RETRY_DELAY_SECONDS:=8}"
: "${PARCELS_TILES_TMP_DIR:=${ROOT_DIR}/var/parcels-sync/tippecanoe-tmp}"
: "${PARCELS_PMTILES_TMP_DIR:=${ROOT_DIR}/var/parcels-sync/pmtiles-tmp}"
: "${PARCELS_PMTILES_CONVERT_RETRY_ATTEMPTS:=3}"
: "${PARCELS_PMTILES_CONVERT_RETRY_DELAY_SECONDS:=5}"
SCHEMA_METADATA_PATH="${PARCELS_TILE_SCHEMA_FILE:-${RUN_DIR}/layer-metadata.json}"
BUILD_LOG_PATH="${SNAPSHOT_ROOT}/postextract-${RUN_ID}.log"
echo "[parcels] tile schema metadata=${SCHEMA_METADATA_PATH}"
echo "[parcels] tile build log path=${BUILD_LOG_PATH}"
STATUS_HEARTBEAT_PID="$(start_status_heartbeat "building" "tiles:building" "5")"
set +e
PARCELS_TILE_SCHEMA_FILE="${SCHEMA_METADATA_PATH}" \
  bash "${ROOT_DIR}/scripts/build-parcels-draw-pmtiles.sh" "${RUN_ID}" 2>&1 | tee "${BUILD_LOG_PATH}"
BUILD_EXIT_CODE="${PIPESTATUS[0]}"
set -e
stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
STATUS_HEARTBEAT_PID=""
if [[ "${BUILD_EXIT_CODE}" -ne 0 ]]; then
  echo "[parcels] ERROR: tile build failed with exit code ${BUILD_EXIT_CODE}" >&2
  exit "${BUILD_EXIT_CODE}"
fi

PMTILES_PATH="$(sed -n 's/^PMTILES_PATH=//p' "${BUILD_LOG_PATH}" | tail -n 1)"

if [[ -z "${PMTILES_PATH}" || ! -f "${PMTILES_PATH}" ]]; then
  echo "[parcels] ERROR: expected PMTiles output file not found: ${PMTILES_PATH}" >&2
  exit 1
fi

echo "[parcels] publishing PMTiles manifest"
write_active_status "publishing" "1"
bun run "${ROOT_DIR}/scripts/publish-parcels-manifest.ts" \
  "--dataset=parcels-draw-v1" \
  "--output-root=${PUBLISH_ROOT}" \
  "--ingestion-run-id=${RUN_ID}" \
  "--pmtiles-path=${PMTILES_PATH}"

echo "[parcels] refresh complete runId=${RUN_ID}"
write_active_status "completed" "0"
