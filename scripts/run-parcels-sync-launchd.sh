#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

if pgrep -f "[/]scripts/refresh-parcels.ts" >/dev/null 2>&1; then
  echo "[launchd] parcels sync already running; skipping duplicate launch"
  exit 0
fi

BUN_BIN="$(command -v bun || true)"
if [[ -z "${BUN_BIN}" ]]; then
  for candidate in /opt/homebrew/bin/bun /usr/local/bin/bun "${HOME}/.bun/bin/bun"; do
    if [[ -x "${candidate}" ]]; then
      BUN_BIN="${candidate}"
      break
    fi
  done
fi

if [[ -z "${BUN_BIN}" ]]; then
  echo "[launchd] bun not found in PATH or common install locations"
  exit 1
fi

export PARCEL_SYNC_MIN_ACRES="${PARCEL_SYNC_MIN_ACRES:-5}"
export PARCEL_SYNC_RESUME="${PARCEL_SYNC_RESUME:-1}"
export PARCEL_SYNC_STATE_CONCURRENCY="${PARCEL_SYNC_STATE_CONCURRENCY:-10}"

echo "[launchd] starting parcels sync min_acres=${PARCEL_SYNC_MIN_ACRES} resume=${PARCEL_SYNC_RESUME} state_concurrency=${PARCEL_SYNC_STATE_CONCURRENCY}"
exec "${BUN_BIN}" run sync:parcels
