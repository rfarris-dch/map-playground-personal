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
  echo "[market-boundaries] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

MARKET_SOURCE_SYNC="${ROOT_DIR}/scripts/sync-market-source.sh"
COUNTY_BOUNDARY_REFRESH="${ROOT_DIR}/scripts/refresh-county-boundaries.sh"
SCHEMA_SQL="${ROOT_DIR}/scripts/sql/market-boundaries-schema.sql"
REFRESH_SQL="${ROOT_DIR}/scripts/sql/refresh-market-boundaries.sql"

if [[ ! -f "${MARKET_SOURCE_SYNC}" ]]; then
  echo "error: market source sync script not found: ${MARKET_SOURCE_SYNC}" >&2
  exit 1
fi

if [[ ! -f "${COUNTY_BOUNDARY_REFRESH}" ]]; then
  echo "error: county boundary refresh script not found: ${COUNTY_BOUNDARY_REFRESH}" >&2
  exit 1
fi

if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

if [[ ! -f "${REFRESH_SQL}" ]]; then
  echo "error: refresh SQL not found: ${REFRESH_SQL}" >&2
  exit 1
fi

bash "${MARKET_SOURCE_SYNC}"
bash "${COUNTY_BOUNDARY_REFRESH}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${REFRESH_SQL}"

echo "[market-boundaries] refreshed derived market boundaries"
