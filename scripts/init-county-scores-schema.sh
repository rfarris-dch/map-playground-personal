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
  echo "[county-scores] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

SCHEMA_SQL="${ROOT_DIR}/scripts/sql/county-scores-schema.sql"
ADJACENCY_SCHEMA_SQL="${ROOT_DIR}/scripts/sql/county-adjacency-schema.sql"
RUN_REPRODUCIBILITY_SCHEMA_SQL="${ROOT_DIR}/scripts/sql/run-reproducibility-schema.sql"
if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

if [[ ! -f "${ADJACENCY_SCHEMA_SQL}" ]]; then
  echo "error: county adjacency schema SQL not found: ${ADJACENCY_SCHEMA_SQL}" >&2
  exit 1
fi

if [[ ! -f "${RUN_REPRODUCIBILITY_SCHEMA_SQL}" ]]; then
  echo "error: run reproducibility schema SQL not found: ${RUN_REPRODUCIBILITY_SCHEMA_SQL}" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${ADJACENCY_SCHEMA_SQL}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${RUN_REPRODUCIBILITY_SCHEMA_SQL}"

echo "[county-scores] schema initialized"
