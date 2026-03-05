#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

: "${POSTGRES_URL:?POSTGRES_URL must be set}"

SCHEMA_SQL="${ROOT_DIR}/scripts/sql/parcels-canonical-schema.sql"
if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

psql "${POSTGRES_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"

echo "[parcels] canonical schema initialized"
