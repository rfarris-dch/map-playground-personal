#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "[facilities-fast] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

REFRESH_SQL="${ROOT_DIR}/scripts/sql/refresh-facilities-fast.sql"

if [[ ! -f "${REFRESH_SQL}" ]]; then
  echo "error: refresh SQL not found: ${REFRESH_SQL}" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${REFRESH_SQL}"

echo "[facilities-fast] refreshed facility read models"
