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

ADJACENCY_REFRESH_SCRIPT="${ROOT_DIR}/scripts/refresh-county-adjacency.ts"
ADJACENCY_SCHEMA_SQL="${ROOT_DIR}/scripts/sql/county-adjacency-schema.sql"
SCHEMA_SQL="${ROOT_DIR}/scripts/sql/county-scores-schema.sql"
GEOMETRY_PREP_SQL="${ROOT_DIR}/scripts/sql/refresh-county-geometry-prep.sql"
ANALYTICAL_ROLLUP_SQL="${ROOT_DIR}/scripts/sql/refresh-county-scores.sql"

if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "error: schema SQL not found: ${SCHEMA_SQL}" >&2
  exit 1
fi

if [[ ! -f "${GEOMETRY_PREP_SQL}" ]]; then
  echo "error: county geometry prep SQL not found: ${GEOMETRY_PREP_SQL}" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICAL_ROLLUP_SQL}" ]]; then
  echo "error: analytical rollup SQL not found: ${ANALYTICAL_ROLLUP_SQL}" >&2
  exit 1
fi

if [[ ! -f "${ADJACENCY_SCHEMA_SQL}" ]]; then
  echo "error: county adjacency schema SQL not found: ${ADJACENCY_SCHEMA_SQL}" >&2
  exit 1
fi

if [[ ! -f "${ADJACENCY_REFRESH_SCRIPT}" ]]; then
  echo "error: county adjacency refresh script not found: ${ADJACENCY_REFRESH_SCRIPT}" >&2
  exit 1
fi

RUN_ID="${COUNTY_SCORES_RUN_ID:-county-scores-$(date -u +%Y%m%dT%H%M%SZ)}"
DATA_VERSION="${COUNTY_SCORES_DATA_VERSION:-$(date -u +%F)}"
FORMULA_VERSION="${COUNTY_SCORES_FORMULA_VERSION:-county-scores-alpha-v1}"
METHODOLOGY_ID="${COUNTY_SCORES_METHODOLOGY_ID:-county-intelligence-alpha-v1}"

if ! command -v bun >/dev/null 2>&1; then
  echo "[county-scores] ERROR: bun not found in PATH" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${ADJACENCY_SCHEMA_SQL}"
bun run "${ADJACENCY_REFRESH_SCRIPT}"
psql "${DB_URL}" \
  -v ON_ERROR_STOP=1 \
  -v data_version="${DATA_VERSION}" \
  -v formula_version="${FORMULA_VERSION}" \
  -f "${GEOMETRY_PREP_SQL}"
psql "${DB_URL}" \
  -v ON_ERROR_STOP=1 \
  -v run_id="${RUN_ID}" \
  -v data_version="${DATA_VERSION}" \
  -v formula_version="${FORMULA_VERSION}" \
  -v methodology_id="${METHODOLOGY_ID}" \
  -f "${ANALYTICAL_ROLLUP_SQL}"

echo "[county-scores] refreshed derived county scores (run_id=${RUN_ID}, data_version=${DATA_VERSION}, methodology_id=${METHODOLOGY_ID})"
