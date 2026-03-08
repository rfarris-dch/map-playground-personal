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
REFRESH_SQL="${ROOT_DIR}/scripts/sql/refresh-county-scores.sql"

if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

if [[ ! -f "${REFRESH_SQL}" ]]; then
  echo "error: refresh SQL not found: ${REFRESH_SQL}" >&2
  exit 1
fi

RUN_ID="${COUNTY_SCORES_RUN_ID:-county-scores-$(date -u +%Y%m%dT%H%M%SZ)}"
DATA_VERSION="${COUNTY_SCORES_DATA_VERSION:-$(date -u +%F)}"
FORMULA_VERSION="${COUNTY_SCORES_FORMULA_VERSION:-county-scores-alpha-v1}"
METHODOLOGY_ID="${COUNTY_SCORES_METHODOLOGY_ID:-county-intelligence-alpha-v1}"

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"
psql "${DB_URL}" \
  -v ON_ERROR_STOP=1 \
  -v run_id="${RUN_ID}" \
  -v data_version="${DATA_VERSION}" \
  -v formula_version="${FORMULA_VERSION}" \
  -v methodology_id="${METHODOLOGY_ID}" \
  -f "${REFRESH_SQL}"

echo "[county-scores] refreshed derived county scores (run_id=${RUN_ID}, data_version=${DATA_VERSION}, methodology_id=${METHODOLOGY_ID})"
