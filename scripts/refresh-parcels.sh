#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

RUN_ID="${RUN_ID:-}"
RUN_REASON="${RUN_REASON:-manual}"
RUN_ID_EXPLICIT=0
if [[ -n "${RUN_ID}" ]]; then
  RUN_ID_EXPLICIT=1
fi
if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
fi
SNAPSHOT_ROOT="${PARCEL_SYNC_OUTPUT_DIR:-${ROOT_DIR}/var/parcels-sync}"
PUBLISH_ROOT="${PARCELS_PUBLISH_ROOT:-${ROOT_DIR}/apps/web/public}"
ACTIVE_STATUS_PATH="${SNAPSHOT_ROOT}/active-run.json"
STATUS_HEARTBEAT_PID=""
SYNC_LOCK_DIR="${SNAPSHOT_ROOT}/sync.lock"
SYNC_LOCK_PID_FILE="${SYNC_LOCK_DIR}/pid"
RUN_DIR=""
RUN_SUMMARY_PATH=""
LOAD_COMPLETE_MARKER_PATH=""
BUILD_COMPLETE_MARKER_PATH=""
TILESOURCE_COMPLETE_MARKER_PATH=""
PUBLISH_COMPLETE_MARKER_PATH=""
RUN_CONFIG_PATH=""
TILES_DATASET="${PARCELS_TILE_DATASET:-parcels-draw-v1}"
TILES_OUT_DIR="${PARCELS_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${TILES_DATASET}}"

write_active_status() {
  local phase="$1"
  local is_running="$2"
  local summary="${3:-__none__}"
  local progress_json="${4:-__none__}"
  python3 - "${ACTIVE_STATUS_PATH}" "${RUN_ID}" "${RUN_REASON}" "${phase}" "${is_running}" "${summary}" "${progress_json}" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, run_id, run_reason, phase, is_running, summary, progress_raw = sys.argv[1:8]
payload = {
    "runId": run_id,
    "reason": run_reason,
    "phase": phase,
    "isRunning": is_running == "1",
    "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "summary": None if summary == "__none__" else summary,
}

progress = None
if progress_raw != "__none__":
    try:
        candidate = json.loads(progress_raw)
    except Exception:
        candidate = None
    if isinstance(candidate, dict):
        progress = candidate

if progress is not None:
    payload["progress"] = progress

with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY
}

start_status_heartbeat() {
  local phase="$1"
  local summary="${2:-__none__}"
  local interval_seconds="${3:-5}"
  local progress_json="${4:-__none__}"

  (
    while true; do
      write_active_status "${phase}" "1" "${summary}" "${progress_json}"
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

write_phase_marker() {
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

  echo "[parcels] ERROR: parcels-sync lock already held (${SYNC_LOCK_DIR})" >&2
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
    write_active_status "failed" "0" "exit_code=${code}" '{"schemaVersion":1,"phase":"failed"}'
  fi
  release_sync_lock
}

trap on_exit EXIT

acquire_sync_lock

: "${ARCGIS_PARCEL_CLIENT_ID:?ARCGIS_PARCEL_CLIENT_ID must be set}"
: "${ARCGIS_PARCEL_CLIENT_SECRET:?ARCGIS_PARCEL_CLIENT_SECRET must be set}"

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
    if [[ -f "${run_dir}/publish-complete.json" ]]; then
      continue
    fi

    if [[ ! -f "${run_dir}/run-config.json" ]]; then
      continue
    fi

    if [[ -f "${run_dir}/run-summary.json" ]] || ls "${run_dir}"/state-*.checkpoint.json >/dev/null 2>&1; then
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

RUN_DIR="${SNAPSHOT_ROOT}/${RUN_ID}"
RUN_SUMMARY_PATH="${RUN_DIR}/run-summary.json"
LOAD_COMPLETE_MARKER_PATH="${RUN_DIR}/load-complete.json"
BUILD_COMPLETE_MARKER_PATH="${RUN_DIR}/tile-build-complete.json"
TILESOURCE_COMPLETE_MARKER_PATH="${RUN_DIR}/tilesource-complete.json"
PUBLISH_COMPLETE_MARKER_PATH="${RUN_DIR}/publish-complete.json"
RUN_CONFIG_PATH="${RUN_DIR}/run-config.json"

if [[ -f "${RUN_CONFIG_PATH}" ]]; then
  VERIFY_CMD=(
    bun
    run
    "${ROOT_DIR}/scripts/refresh-parcels.ts"
    "--output-dir=${SNAPSHOT_ROOT}"
    "--run-id=${RUN_ID}"
    "--verify-run-config-only"
  )
  VERIFY_CMD+=("${EXTRACT_ARGS[@]}")
  echo "[parcels] verifying saved run config for runId=${RUN_ID}"
  "${VERIFY_CMD[@]}"
fi

echo "[parcels] refresh start runId=${RUN_ID}"
echo "[parcels] snapshot root=${SNAPSHOT_ROOT}"
echo "[parcels] publish root=${PUBLISH_ROOT}"
write_active_status "extracting" "1" "__none__" '{"schemaVersion":1,"phase":"extracting"}'
if [[ -f "${RUN_SUMMARY_PATH}" ]]; then
  echo "[parcels] extraction already complete for runId=${RUN_ID}; skipping extract phase"
else
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
fi

if [[ ! -d "${RUN_DIR}" ]]; then
  echo "[parcels] ERROR: expected run directory not found: ${RUN_DIR}" >&2
  exit 1
fi
if [[ ! -f "${RUN_SUMMARY_PATH}" ]]; then
  echo "[parcels] ERROR: extraction did not produce run summary: ${RUN_SUMMARY_PATH}" >&2
  exit 1
fi

if [[ -f "${LOAD_COMPLETE_MARKER_PATH}" ]]; then
  echo "[parcels] load phase already complete for runId=${RUN_ID}; skipping canonical load"
else
  echo "[parcels] loading canonical table and swapping current snapshot"
  write_active_status "loading" "1" "__none__" '{"schemaVersion":1,"phase":"loading"}'
  ACTIVE_STATUS_PATH="${ACTIVE_STATUS_PATH}" \
    RUN_REASON="${RUN_REASON}" \
    bash "${ROOT_DIR}/scripts/load-parcels-canonical.sh" "${RUN_DIR}" "${RUN_ID}"
  write_phase_marker "${LOAD_COMPLETE_MARKER_PATH}" "loading" "canonical-load-complete"
fi

PMTILES_PATH="${TILES_OUT_DIR}/${TILES_DATASET}_${RUN_ID}.pmtiles"
if [[ -f "${TILESOURCE_COMPLETE_MARKER_PATH}" ]]; then
  echo "[parcels] tilesource refresh already complete for runId=${RUN_ID}; skipping"
else
  echo "[parcels] refreshing parcel tilesource table"
  write_active_status "building" "1" "tilesource:refreshing" '{"schemaVersion":1,"phase":"building","tileBuild":{"stage":"tilesource"}}'
  bash "${ROOT_DIR}/scripts/refresh-parcel-tilesource.sh" "${RUN_ID}"
  write_phase_marker "${TILESOURCE_COMPLETE_MARKER_PATH}" "building" "tilesource-refresh-complete"
fi

if [[ -f "${BUILD_COMPLETE_MARKER_PATH}" && -f "${PMTILES_PATH}" ]]; then
  echo "[parcels] tile build already complete for runId=${RUN_ID}; skipping build"
else
  echo "[parcels] building parcels draw PMTiles"
  write_active_status "building" "1" "tiles:building" '{"schemaVersion":1,"phase":"building","tileBuild":{"stage":"build"}}'
  # Faster tile-build defaults for nationwide runs.
  : "${PARCELS_TILES_STAGE_GEOJSON_FILE:=1}"
  : "${PARCELS_TILES_REUSE_GEOJSON_FILE:=1}"
  : "${PARCELS_TILES_KEEP_STAGED_GEOJSON_FILE:=1}"
  : "${PARCELS_TILES_DETECT_SHARED_BORDERS:=0}"
  : "${PARCELS_TILES_MIN_ZOOM:=0}"
  : "${PARCELS_TILES_THIN_DEFAULT_MAX_ZOOM:=15}"
  : "${PARCELS_TILES_TMP_DIR:=${ROOT_DIR}/var/parcels-sync/planetiler-tmp}"
  SCHEMA_METADATA_PATH="${PARCELS_TILE_SCHEMA_FILE:-${RUN_DIR}/layer-metadata.json}"
  BUILD_LOG_PATH="${SNAPSHOT_ROOT}/postextract-${RUN_ID}.log"
  echo "[parcels] tile schema metadata=${SCHEMA_METADATA_PATH}"
  echo "[parcels] tile build log path=${BUILD_LOG_PATH}"
  STATUS_HEARTBEAT_PID="$(start_status_heartbeat "building" "tiles:building" "5" '{"schemaVersion":1,"phase":"building","tileBuild":{"stage":"build"}}')"
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
  if [[ ! -f "${PMTILES_PATH}" ]]; then
    echo "[parcels] ERROR: expected PMTiles output file not found: ${PMTILES_PATH}" >&2
    exit 1
  fi
  write_phase_marker \
    "${BUILD_COMPLETE_MARKER_PATH}" \
    "building" \
    "tile-build-complete" \
    "{\"dataset\":\"${TILES_DATASET}\",\"pmtilesPath\":\"${PMTILES_PATH}\"}"
fi

if [[ -f "${PUBLISH_COMPLETE_MARKER_PATH}" ]]; then
  echo "[parcels] publish phase already complete for runId=${RUN_ID}; skipping manifest publish"
else
  echo "[parcels] publishing PMTiles manifest"
  write_active_status "publishing" "1" "__none__" '{"schemaVersion":1,"phase":"publishing"}'
  bun run "${ROOT_DIR}/scripts/publish-parcels-manifest.ts" \
    "--dataset=${TILES_DATASET}" \
    "--output-root=${PUBLISH_ROOT}" \
    "--ingestion-run-id=${RUN_ID}" \
    "--run-id=${RUN_ID}"
  write_phase_marker "${PUBLISH_COMPLETE_MARKER_PATH}" "publishing" "manifest-published"
fi

echo "[parcels] refresh complete runId=${RUN_ID}"
write_active_status "completed" "0" "__none__" '{"schemaVersion":1,"phase":"completed"}'
