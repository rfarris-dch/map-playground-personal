#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DATASET="${ENVIRONMENTAL_SYNC_DATASET:-}"
if [[ -z "${DATASET}" ]]; then
  echo "[environmental] ERROR: ENVIRONMENTAL_SYNC_DATASET must be set" >&2
  exit 1
fi

case "${DATASET}" in
  environmental-flood)
    DATASET_TAG="environmental-flood"
    STAGE_SCRIPT_PATH="${ROOT_DIR}/scripts/refresh-environmental-flood.ts"
    SNAPSHOT_ROOT_DEFAULT="${ROOT_DIR}/var/environmental-sync/environmental-flood"
    TILES_OUT_DIR_DEFAULT="${ROOT_DIR}/.cache/tiles/environmental-flood"
    ;;
  environmental-hydro-basins)
    DATASET_TAG="environmental-hydro-basins"
    STAGE_SCRIPT_PATH="${ROOT_DIR}/scripts/refresh-environmental-hydro-basins.ts"
    SNAPSHOT_ROOT_DEFAULT="${ROOT_DIR}/var/environmental-sync/environmental-hydro-basins"
    TILES_OUT_DIR_DEFAULT="${ROOT_DIR}/.cache/tiles/environmental-hydro-basins"
    ;;
  *)
    echo "[environmental] ERROR: unsupported dataset ${DATASET}" >&2
    exit 1
    ;;
esac

RUN_ID="${RUN_ID:-}"
RUN_REASON="${RUN_REASON:-manual}"
for ARG in "$@"; do
  case "$ARG" in
    --run-id=*|--runId=*)
      RUN_ID="${ARG#*=}"
      ;;
  esac
done

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
fi

SNAPSHOT_ROOT="${ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT:-${SNAPSHOT_ROOT_DEFAULT}}"
PUBLISH_ROOT="${ENVIRONMENTAL_SYNC_PUBLISH_ROOT:-${ROOT_DIR}/apps/web/public}"
RUN_DIR="${SNAPSHOT_ROOT}/${RUN_ID}"
ACTIVE_STATUS_PATH="${RUN_DIR}/active-run.json"
RUN_SUMMARY_PATH="${RUN_DIR}/run-summary.json"
LOAD_COMPLETE_MARKER_PATH="${RUN_DIR}/load-complete.json"
BUILD_COMPLETE_MARKER_PATH="${RUN_DIR}/tile-build-complete.json"
PUBLISH_COMPLETE_MARKER_PATH="${RUN_DIR}/publish-complete.json"
LATEST_PATH="${SNAPSHOT_ROOT}/latest.json"
SYNC_LOCK_DIR="${SNAPSHOT_ROOT}/sync.lock"
SYNC_LOCK_PID_FILE="${SYNC_LOCK_DIR}/pid"
BUILD_LOG_PATH="${RUN_DIR}/postextract-${RUN_ID}.log"
STATUS_HEARTBEAT_PID=""
case "${DATASET_TAG}" in
  environmental-flood)
    TILES_OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${ENVIRONMENTAL_TILES_OUT_DIR:-${TILES_OUT_DIR_DEFAULT}}}"
    ;;
  environmental-hydro-basins)
    TILES_OUT_DIR="${ENVIRONMENTAL_HYDRO_TILES_OUT_DIR:-${ENVIRONMENTAL_TILES_OUT_DIR:-${TILES_OUT_DIR_DEFAULT}}}"
    ;;
esac
PMTILES_PATH="${TILES_OUT_DIR}/${DATASET_TAG}_${RUN_ID}.pmtiles"

mkdir -p "${RUN_DIR}/raw" "${RUN_DIR}/normalized"

NORMALIZED_EXPECTED=()
case "${DATASET_TAG}" in
  environmental-flood)
    NORMALIZED_EXPECTED=(
      "${RUN_DIR}/normalized/flood-hazard.geojson"
    )
    ;;
  environmental-hydro-basins)
    NORMALIZED_EXPECTED=(
      "${RUN_DIR}/normalized/huc4-line.geojson"
      "${RUN_DIR}/normalized/huc4-label.geojson"
      "${RUN_DIR}/normalized/huc6-line.geojson"
      "${RUN_DIR}/normalized/huc6-label.geojson"
      "${RUN_DIR}/normalized/huc8-line.geojson"
      "${RUN_DIR}/normalized/huc8-label.geojson"
      "${RUN_DIR}/normalized/huc10-line.geojson"
      "${RUN_DIR}/normalized/huc10-label.geojson"
      "${RUN_DIR}/normalized/huc12-line.geojson"
    )
    ;;
esac

write_active_status() {
  local phase="$1"
  local is_running="$2"
  local summary="${3:-__none__}"
  python3 - "${ACTIVE_STATUS_PATH}" "${RUN_ID}" "${RUN_REASON}" "${phase}" "${is_running}" "${summary}" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, run_id, run_reason, phase, is_running, summary = sys.argv[1:7]
payload = {
    "runId": run_id,
    "reason": run_reason,
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
  (
    while true; do
      write_active_status "${phase}" "1" "${summary}"
      sleep 5
    done
  ) &
  STATUS_HEARTBEAT_PID="$!"
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

write_marker() {
  local marker_path="$1"
  local phase="$2"
  local summary="${3:-__none__}"
  local extra_json="${4:-__none__}"

  python3 - "${marker_path}" "${RUN_ID}" "${phase}" "${summary}" "${extra_json}" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, run_id, phase, summary, extra_raw = sys.argv[1:6]
payload = {
    "runId": run_id,
    "phase": phase,
    "completedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
}
if summary != "__none__":
    payload["summary"] = summary
if extra_raw != "__none__":
    try:
        extra = json.loads(extra_raw)
    except Exception:
        extra = None
    if isinstance(extra, dict):
        payload.update(extra)

with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY
}

acquire_sync_lock() {
  mkdir -p "${SNAPSHOT_ROOT}"

  if mkdir "${SYNC_LOCK_DIR}" 2>/dev/null; then
    printf '%s\n' "$$" > "${SYNC_LOCK_PID_FILE}"
    return
  fi

  local lock_pid
  lock_pid="$(cat "${SYNC_LOCK_PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${lock_pid}" ]] && ! kill -0 "${lock_pid}" 2>/dev/null; then
    rm -rf "${SYNC_LOCK_DIR}"
    if mkdir "${SYNC_LOCK_DIR}" 2>/dev/null; then
      printf '%s\n' "$$" > "${SYNC_LOCK_PID_FILE}"
      return
    fi
  fi

  echo "[environmental] ERROR: sync lock already held (${SYNC_LOCK_DIR})" >&2
  exit 16
}

release_sync_lock() {
  if [[ -d "${SYNC_LOCK_DIR}" ]]; then
    rm -rf "${SYNC_LOCK_DIR}" || true
  fi
}

on_exit() {
  local code=$?
  stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
  if [[ ${code} -ne 0 ]]; then
    write_active_status "failed" "0" "exit_code=${code}"
  fi
  release_sync_lock
}

trap on_exit EXIT

acquire_sync_lock

echo "[environmental] refresh start dataset=${DATASET_TAG} runId=${RUN_ID}"
write_active_status "extracting" "1" "__none__"
if [[ -f "${RUN_SUMMARY_PATH}" ]]; then
  echo "[environmental] extract already complete for runId=${RUN_ID}; skipping extract phase"
else
  bun run "${STAGE_SCRIPT_PATH}" "--run-id=${RUN_ID}" "--step=extract"
fi

if [[ ! -f "${RUN_SUMMARY_PATH}" ]]; then
  echo "[environmental] ERROR: extract phase did not write ${RUN_SUMMARY_PATH}" >&2
  exit 1
fi

NORMALIZED_READY=1
for path in "${NORMALIZED_EXPECTED[@]}"; do
  if [[ ! -f "${path}" ]]; then
    NORMALIZED_READY=0
    break
  fi
done

if [[ -f "${LOAD_COMPLETE_MARKER_PATH}" && ${NORMALIZED_READY} -eq 1 ]]; then
  echo "[environmental] normalize phase already complete for runId=${RUN_ID}; skipping"
else
  write_active_status "loading" "1" "__none__"
  bun run "${STAGE_SCRIPT_PATH}" "--run-id=${RUN_ID}" "--step=normalize"
  write_marker "${LOAD_COMPLETE_MARKER_PATH}" "loading" "normalization-complete"
fi

for path in "${NORMALIZED_EXPECTED[@]}"; do
  if [[ ! -f "${path}" ]]; then
    echo "[environmental] ERROR: normalized output missing ${path}" >&2
    exit 1
  fi
done

if [[ -f "${BUILD_COMPLETE_MARKER_PATH}" && -f "${PMTILES_PATH}" ]]; then
  echo "[environmental] tile build already complete for runId=${RUN_ID}; skipping"
else
  write_active_status "building" "1" "tiles:building"
  start_status_heartbeat "building" "tiles:building"
  set +e
  case "${DATASET_TAG}" in
    environmental-flood)
      ENVIRONMENTAL_FLOOD_SOURCE_FILE="${RUN_DIR}/normalized/flood-hazard.geojson" \
        ENVIRONMENTAL_FLOOD_TILES_OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${TILES_OUT_DIR_DEFAULT}}" \
        bash "${ROOT_DIR}/scripts/build-environmental-flood-pmtiles.sh" "${RUN_ID}" 2>&1 | tee "${BUILD_LOG_PATH}"
      BUILD_EXIT_CODE="${PIPESTATUS[0]}"
      ;;
    environmental-hydro-basins)
      ENVIRONMENTAL_HYDRO_SOURCE_ROOT="${RUN_DIR}/normalized" \
        ENVIRONMENTAL_HYDRO_TILES_OUT_DIR="${ENVIRONMENTAL_HYDRO_TILES_OUT_DIR:-${TILES_OUT_DIR_DEFAULT}}" \
        bash "${ROOT_DIR}/scripts/build-environmental-hydro-basins-pmtiles.sh" "${RUN_ID}" 2>&1 | tee "${BUILD_LOG_PATH}"
      BUILD_EXIT_CODE="${PIPESTATUS[0]}"
      ;;
  esac
  set -e
  stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
  STATUS_HEARTBEAT_PID=""
  if [[ "${BUILD_EXIT_CODE}" -ne 0 ]]; then
    echo "[environmental] ERROR: tile build failed with exit code ${BUILD_EXIT_CODE}" >&2
    exit "${BUILD_EXIT_CODE}"
  fi
  if [[ ! -f "${PMTILES_PATH}" ]]; then
    echo "[environmental] ERROR: expected PMTiles output file not found: ${PMTILES_PATH}" >&2
    exit 1
  fi
  write_marker \
    "${BUILD_COMPLETE_MARKER_PATH}" \
    "building" \
    "tile-build-complete" \
    "{\"dataset\":\"${DATASET_TAG}\",\"pmtilesPath\":\"${PMTILES_PATH}\"}"
fi

if [[ -f "${PUBLISH_COMPLETE_MARKER_PATH}" ]]; then
  echo "[environmental] publish already complete for runId=${RUN_ID}; skipping"
else
  write_active_status "publishing" "1" "__none__"
  bun run "${ROOT_DIR}/scripts/publish-parcels-manifest.ts" \
    "--dataset=${DATASET_TAG}" \
    "--output-root=${PUBLISH_ROOT}" \
    "--ingestion-run-id=${RUN_ID}" \
    "--run-id=${RUN_ID}" \
    "--snapshot-root=${SNAPSHOT_ROOT}" \
    "--tiles-out-dir=${TILES_OUT_DIR}"
  write_marker "${PUBLISH_COMPLETE_MARKER_PATH}" "publishing" "manifest-published"
fi

python3 - "${LATEST_PATH}" "${RUN_ID}" "${RUN_DIR}" "${DATASET_TAG}" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, run_id, run_dir, dataset = sys.argv[1:5]
payload = {
    "dataset": dataset,
    "runId": run_id,
    "runDir": run_dir,
    "completedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY

write_active_status "completed" "0" "__none__"
echo "[environmental] refresh complete dataset=${DATASET_TAG} runId=${RUN_ID}"
