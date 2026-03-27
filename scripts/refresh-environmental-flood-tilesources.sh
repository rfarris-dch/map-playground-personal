#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DATABASE_URL_VALUE="${ENVIRONMENTAL_FLOOD_DATABASE_URL:-${DATABASE_URL:-}}"
RUN_ID="${1:-}"
OVERLAY_KIND="${2:-${ENVIRONMENTAL_FLOOD_OVERLAY_KIND:-all}}"
TARGET_ROOT="${ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-flood/${RUN_ID}}"

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

overlay_output_path() {
  local overlay_kind="$1"
  printf "%s/flood-overlay-%s.gpkg" "${TARGET_ROOT}" "${overlay_kind}"
}

overlay_output_ready() {
  local overlay_kind="$1"
  local output_path

  output_path="$(overlay_output_path "${overlay_kind}")"
  [[ -s "${output_path}" ]]
}

export_overlay_kind() {
  local overlay_kind="$1"
  local output_path

  output_path="$(overlay_output_path "${overlay_kind}")"

  if overlay_output_ready "${overlay_kind}"; then
    echo "[tilesource] reusing existing flood-overlay-${overlay_kind}.gpkg for runId=${RUN_ID}" >&2
  else
    echo "[tilesource] exporting flood-overlay-${overlay_kind}.gpkg for runId=${RUN_ID}" >&2
    bun run "${ROOT_DIR}/scripts/export-environmental-planetiler-inputs.ts" \
      "--dataset=environmental-flood" \
      "--run-id=${RUN_ID}" \
      "--overlay-kind=${overlay_kind}" \
      "--output-root=${TARGET_ROOT}"
  fi
}

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[tilesource] ERROR: DATABASE_URL or ENVIRONMENTAL_FLOOD_DATABASE_URL is required" >&2
  exit 1
fi

for bin in psql bun; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tilesource] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(resolve_latest_run_id)"
  TARGET_ROOT="${ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-flood/${RUN_ID}}"
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[tilesource] ERROR: unable to resolve flood run id" >&2
  exit 1
fi

case "${OVERLAY_KIND}" in
  all)
    export_overlay_kind "100"
    export_overlay_kind "500"
    ;;
  100|500)
    export_overlay_kind "${OVERLAY_KIND}"
    ;;
  *)
    echo "[tilesource] ERROR: overlay kind must be one of 100, 500, all" >&2
    exit 1
    ;;
esac

bun run "${ROOT_DIR}/scripts/validate-environmental-flood-parity.ts" \
  "--run-id=${RUN_ID}" \
  "--overlay-kind=${OVERLAY_KIND}" \
  "--output-root=${TARGET_ROOT}"
