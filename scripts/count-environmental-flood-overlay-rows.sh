#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL_VALUE="${ENVIRONMENTAL_FLOOD_DATABASE_URL:-${DATABASE_URL:-}}"
RUN_ID="${1:-}"

quote_sql_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "${value}"
}

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[count] ERROR: DATABASE_URL or ENVIRONMENTAL_FLOOD_DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[count] ERROR: usage: scripts/count-environmental-flood-overlay-rows.sh <run-id>" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[count] ERROR: missing dependency in PATH: psql" >&2
  exit 1
fi

RUN_ID_SQL="$(quote_sql_literal "${RUN_ID}")"

echo "[count] reading persisted flood overlay row total for ${RUN_ID}" >&2

PGAPPNAME="flood-overlay-tilesource-count" \
psql "${DATABASE_URL_VALUE}" \
  -v ON_ERROR_STOP=1 \
  -At \
  -c "
SELECT
  COALESCE((
    SELECT count(*)
    FROM environmental_tiles.flood_overlay_100
    WHERE run_id = ${RUN_ID_SQL}
  ), 0)
  +
  COALESCE((
    SELECT count(*)
    FROM environmental_tiles.flood_overlay_500
    WHERE run_id = ${RUN_ID_SQL}
  ), 0);
"
