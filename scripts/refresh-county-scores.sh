#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "[county-scores] ERROR: bun not found in PATH" >&2
  exit 1
fi

exec bun run "${ROOT_DIR}/scripts/refresh-county-scores.ts" "$@"
