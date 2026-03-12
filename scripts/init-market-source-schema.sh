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
  echo "[market-source] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

SCHEMA_SQL="${ROOT_DIR}/scripts/sql/market-source-schema.sql"
if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"

echo "[market-source] schema initialized"
