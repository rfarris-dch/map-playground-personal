#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${ENVIRONMENTAL_FLOOD_DATABASE_URL:-${DATABASE_URL:-}}"
RUN_ID="${1:-}"
OVERLAY_KIND="${2:-${ENVIRONMENTAL_FLOOD_OVERLAY_KIND:-all}}"
SUBDIVIDE_VERTICES="${ENVIRONMENTAL_FLOOD_SUBDIVIDE_VERTICES:-255}"
SQL_PATH="${ROOT_DIR}/scripts/sql/refresh-environmental-flood-tilesource.sql"

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

refresh_overlay_kind() {
  local overlay_kind="$1"
  local overlay_filter=""
  local overlay_table=""
  local overlay_table_log=""

  case "${overlay_kind}" in
    100)
      overlay_filter="flood.is_flood_100"
      overlay_table="environmental_tiles.flood_overlay_100"
      overlay_table_log="flood_overlay_100"
      ;;
    500)
      overlay_filter="flood.is_flood_500"
      overlay_table="environmental_tiles.flood_overlay_500"
      overlay_table_log="flood_overlay_500"
      ;;
    *)
      echo "[tilesource] ERROR: unsupported overlay kind ${overlay_kind}" >&2
      exit 1
      ;;
  esac

  echo "[tilesource] refreshing ${overlay_table_log} for runId=${RUN_ID}" >&2
  psql "${DATABASE_URL_VALUE}" \
    -v ON_ERROR_STOP=1 \
    -v overlay_filter="${overlay_filter}" \
    -v overlay_kind_sql="$(quote_sql_literal "${overlay_kind}")" \
    -v overlay_table="${overlay_table}" \
    -v run_id_sql="$(quote_sql_literal "${RUN_ID}")" \
    -v subdivide_vertices="${SUBDIVIDE_VERTICES}" \
    -f "${SQL_PATH}"
}

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[tilesource] ERROR: DATABASE_URL or ENVIRONMENTAL_FLOOD_DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[tilesource] ERROR: missing dependency in PATH: psql" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(resolve_latest_run_id)"
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[tilesource] ERROR: unable to resolve flood run id" >&2
  exit 1
fi

case "${OVERLAY_KIND}" in
  all)
    refresh_overlay_kind "100"
    refresh_overlay_kind "500"
    ;;
  100|500)
    refresh_overlay_kind "${OVERLAY_KIND}"
    ;;
  *)
    echo "[tilesource] ERROR: overlay kind must be one of 100, 500, all" >&2
    exit 1
    ;;
esac
