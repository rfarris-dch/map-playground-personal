#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${1:-${RUN_ID:-}}"
TARGET_ROOT="${ENVIRONMENTAL_HYDRO_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-hydro-basins/${RUN_ID}}"

resolve_latest_run_id() {
  python3 - "${ROOT_DIR}/var/environmental-sync/environmental-hydro-basins/latest.json" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception:
    raise SystemExit(0)

run_id = payload.get("runId")
if not isinstance(run_id, str) or not run_id.strip():
    current = payload.get("current")
    if isinstance(current, dict):
        candidate = current.get("ingestionRunId")
        if isinstance(candidate, str) and candidate.strip():
            run_id = candidate
if isinstance(run_id, str) and run_id.strip():
    print(run_id.strip())
PY
}

for bin in bun python3; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tilesource] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(resolve_latest_run_id)"
  TARGET_ROOT="${ENVIRONMENTAL_HYDRO_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-hydro-basins/${RUN_ID}}"
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[tilesource] ERROR: run id is required" >&2
  exit 1
fi

echo "[tilesource] exporting hydro Planetiler inputs from canonical GeoParquet for runId=${RUN_ID}" >&2

bun run "${ROOT_DIR}/scripts/export-environmental-planetiler-inputs.ts" \
  "--dataset=environmental-hydro-basins" \
  "--run-id=${RUN_ID}" \
  "--output-root=${TARGET_ROOT}"

echo "[tilesource] hydro tilesource export complete target_root=${TARGET_ROOT}" >&2
