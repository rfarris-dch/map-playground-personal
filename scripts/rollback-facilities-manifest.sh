#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${DATABASE_URL:-${POSTGRES_URL:-}}"
TARGET_VERSION="${1:-${FACILITIES_TARGET_VERSION:-}}"
ROLLBACK_SQL="${ROOT_DIR}/scripts/sql/rollback-facilities-manifest.sql"

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[facilities-rollback] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[facilities-rollback] ERROR: psql is required" >&2
  exit 1
fi

echo "[facilities-rollback] rolling manifest${TARGET_VERSION:+ to ${TARGET_VERSION}}"

psql "${DATABASE_URL_VALUE}" \
  -v ON_ERROR_STOP=1 \
  -v target_version="${TARGET_VERSION}" \
  -f "${ROLLBACK_SQL}"
