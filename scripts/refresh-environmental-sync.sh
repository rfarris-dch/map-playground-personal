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

SNAPSHOT_ROOT="${ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT:-${SNAPSHOT_ROOT_DEFAULT}}"
PUBLISH_ROOT="${ENVIRONMENTAL_SYNC_PUBLISH_ROOT:-${ROOT_DIR}/apps/web/public}"
RUN_ID="${RUN_ID:-}"
RUN_REASON="${RUN_REASON:-manual}"
for ARG in "$@"; do
  case "$ARG" in
    --run-id=*|--runId=*)
      RUN_ID="${ARG#*=}"
      ;;
  esac
done

find_resumable_run_id() {
  python3 - "${SNAPSHOT_ROOT}" <<'PY'
import json
import os
import sys

snapshot_root = sys.argv[1]
if not os.path.isdir(snapshot_root):
    raise SystemExit(0)

best_run_id = None
best_sort_key = ""

for entry_name in os.listdir(snapshot_root):
    run_dir = os.path.join(snapshot_root, entry_name)
    if not os.path.isdir(run_dir):
      continue

    if os.path.exists(os.path.join(run_dir, "publish-complete.json")):
      continue

    run_config_path = os.path.join(run_dir, "run-config.json")
    if not os.path.isfile(run_config_path):
      continue

    run_id = entry_name
    updated_at = ""

    for candidate_name, field_name in (
      ("active-run.json", "updatedAt"),
      ("normalize-progress.json", "updatedAt"),
      ("run-config.json", "createdAt"),
    ):
      candidate_path = os.path.join(run_dir, candidate_name)
      if not os.path.isfile(candidate_path):
        continue

      try:
        with open(candidate_path, "r", encoding="utf-8") as handle:
          payload = json.load(handle)
      except Exception:
        continue

      raw_value = payload.get(field_name)
      if isinstance(raw_value, str) and raw_value.strip():
        updated_at = raw_value.strip()
        break

    if not updated_at:
      updated_at = f"{os.path.getmtime(run_dir):020.6f}"

    sort_key = f"{updated_at}|{run_id}"
    if sort_key > best_sort_key:
      best_sort_key = sort_key
      best_run_id = run_id

if best_run_id:
    print(best_run_id)
PY
}

if [[ -z "${RUN_ID}" ]]; then
  RESUMABLE_RUN_ID="$(find_resumable_run_id)"
  if [[ -n "${RESUMABLE_RUN_ID}" ]]; then
    RUN_ID="${RESUMABLE_RUN_ID}"
    echo "[environmental] resuming incomplete runId=${RUN_ID}"
  else
    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
  fi
fi

RUN_DIR="${SNAPSHOT_ROOT}/${RUN_ID}"
ACTIVE_STATUS_PATH="${RUN_DIR}/active-run.json"
RUN_SUMMARY_PATH="${RUN_DIR}/run-summary.json"
NORMALIZE_COMPLETE_MARKER_PATH="${RUN_DIR}/normalize-complete.json"
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
mkdir -p "${RUN_DIR}/tmp"
export TMPDIR="${RUN_DIR}/tmp"

NORMALIZED_EXPECTED=()
case "${DATASET_TAG}" in
  environmental-flood)
    NORMALIZED_EXPECTED=(
      "${RUN_DIR}/normalized/flood-hazard.geojson"
      "${RUN_DIR}/normalized/flood-hazard.geojsonl"
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
import os
import sys
from datetime import datetime, timezone

path, run_id, run_reason, phase, is_running, summary = sys.argv[1:7]
existing = {}
if os.path.isfile(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        if isinstance(loaded, dict):
            existing = loaded
    except Exception:
        existing = {}

started_at = existing.get("startedAt")
if not isinstance(started_at, str) or not started_at:
    started_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

summary_value = None
if summary == "__preserve__":
    existing_summary = existing.get("summary")
    summary_value = existing_summary if isinstance(existing_summary, str) and existing_summary else None
elif summary != "__none__":
    summary_value = summary

payload = {
    "runId": run_id,
    "reason": run_reason,
    "phase": phase,
    "isRunning": is_running == "1",
    "startedAt": started_at,
    "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "summary": summary_value,
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
if [[ -f "${RUN_SUMMARY_PATH}" ]]; then
  echo "[environmental] extract already complete for runId=${RUN_ID}; skipping extract phase"
else
  write_active_status "extracting" "1" "__preserve__"
  start_status_heartbeat "extracting" "__preserve__"
  bun run "${STAGE_SCRIPT_PATH}" "--run-id=${RUN_ID}" "--step=extract"
  stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
  STATUS_HEARTBEAT_PID=""
fi

if [[ ! -f "${RUN_SUMMARY_PATH}" ]]; then
  echo "[environmental] ERROR: extract phase did not write ${RUN_SUMMARY_PATH}" >&2
  exit 1
fi

NORMALIZED_READY=0
FLOOD_DIRECT_POSTGRES=0
if [[ "${DATASET_TAG}" == "environmental-flood" && -f "${RUN_DIR}/run-config.json" ]]; then
  FLOOD_DIRECT_POSTGRES="$(
    python3 - "${RUN_DIR}/run-config.json" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception:
    print("0")
    raise SystemExit(0)

options = payload.get("options")
if not isinstance(options, dict):
    print("0")
    raise SystemExit(0)

print("1" if options.get("normalizeStrategy") == "direct-postgres" else "0")
PY
  )"
fi
case "${DATASET_TAG}" in
  environmental-flood)
    if [[ "${FLOOD_DIRECT_POSTGRES}" == "1" ]]; then
      NORMALIZED_READY=1
    else
      for path in "${NORMALIZED_EXPECTED[@]}"; do
        if [[ -f "${path}" ]]; then
          NORMALIZED_READY=1
          break
        fi
      done
    fi
    ;;
  *)
    NORMALIZED_READY=1
    for path in "${NORMALIZED_EXPECTED[@]}"; do
      if [[ ! -f "${path}" ]]; then
        NORMALIZED_READY=0
        break
      fi
    done
    ;;
esac

if [[ -f "${NORMALIZE_COMPLETE_MARKER_PATH}" && ${NORMALIZED_READY} -eq 1 ]]; then
  echo "[environmental] normalize phase already complete for runId=${RUN_ID}; skipping"
else
  write_active_status "normalizing" "1" "__preserve__"
  start_status_heartbeat "normalizing" "__preserve__"
  bun run "${STAGE_SCRIPT_PATH}" "--run-id=${RUN_ID}" "--step=normalize"
  stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
  STATUS_HEARTBEAT_PID=""
  write_marker "${NORMALIZE_COMPLETE_MARKER_PATH}" "normalizing" "normalization-complete"
fi

NORMALIZED_PATH=""
if [[ "${FLOOD_DIRECT_POSTGRES}" != "1" ]]; then
  for path in "${NORMALIZED_EXPECTED[@]}"; do
    if [[ -f "${path}" ]]; then
      NORMALIZED_PATH="${path}"
      break
    fi
  done
fi

if [[ -z "${NORMALIZED_PATH}" && "${FLOOD_DIRECT_POSTGRES}" != "1" ]]; then
  echo "[environmental] ERROR: normalized output missing for ${DATASET_TAG}" >&2
  exit 1
fi

case "${DATASET_TAG}" in
  environmental-flood)
    if [[ -f "${LOAD_COMPLETE_MARKER_PATH}" ]]; then
      echo "[environmental] flood load already complete for runId=${RUN_ID}; skipping"
    else
      write_active_status "loading" "1" "__preserve__"
      start_status_heartbeat "loading" "__preserve__"
      bun run "${STAGE_SCRIPT_PATH}" "--run-id=${RUN_ID}" "--step=load"
      stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
      STATUS_HEARTBEAT_PID=""
      write_marker "${LOAD_COMPLETE_MARKER_PATH}" "loading" "database-load-complete"
    fi
    ;;
  environmental-hydro-basins)
    if [[ ! -f "${LOAD_COMPLETE_MARKER_PATH}" ]]; then
      write_marker "${LOAD_COMPLETE_MARKER_PATH}" "loading" "normalization-only"
    fi
    ;;
esac

if [[ -f "${BUILD_COMPLETE_MARKER_PATH}" && -f "${PMTILES_PATH}" ]]; then
  echo "[environmental] tile build already complete for runId=${RUN_ID}; skipping"
else
  write_active_status "building" "1" "tiles:building"
  start_status_heartbeat "building" "tiles:building"
  set +e
  case "${DATASET_TAG}" in
    environmental-flood)
      if [[ "${FLOOD_DIRECT_POSTGRES}" == "1" ]]; then
        ENVIRONMENTAL_FLOOD_SOURCE_RUN_ID="${RUN_ID}" \
          ENVIRONMENTAL_FLOOD_TILES_OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${TILES_OUT_DIR_DEFAULT}}" \
          bash "${ROOT_DIR}/scripts/build-environmental-flood-pmtiles.sh" "${RUN_ID}" 2>&1 | tee "${BUILD_LOG_PATH}"
      else
        ENVIRONMENTAL_FLOOD_SOURCE_FILE="${NORMALIZED_PATH}" \
          ENVIRONMENTAL_FLOOD_TILES_OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${TILES_OUT_DIR_DEFAULT}}" \
          bash "${ROOT_DIR}/scripts/build-environmental-flood-pmtiles.sh" "${RUN_ID}" 2>&1 | tee "${BUILD_LOG_PATH}"
      fi
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
  write_active_status "publishing" "1" "__preserve__"
  start_status_heartbeat "publishing" "__preserve__"
  bun run "${ROOT_DIR}/scripts/publish-parcels-manifest.ts" \
    "--dataset=${DATASET_TAG}" \
    "--output-root=${PUBLISH_ROOT}" \
    "--ingestion-run-id=${RUN_ID}" \
    "--run-id=${RUN_ID}" \
    "--snapshot-root=${SNAPSHOT_ROOT}" \
    "--tiles-out-dir=${TILES_OUT_DIR}"
  stop_status_heartbeat "${STATUS_HEARTBEAT_PID}"
  STATUS_HEARTBEAT_PID=""
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

write_active_status "completed" "0" "manifest-published"
echo "[environmental] refresh complete dataset=${DATASET_TAG} runId=${RUN_ID}"
