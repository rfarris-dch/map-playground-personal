#!/usr/bin/env bash
set -euo pipefail

health_url="${MAP_API_HEALTH_URL:-http://127.0.0.1:${PORT:-3001}/api/health}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[health] curl is required to validate the API health endpoint" >&2
  exit 1
fi

response="$(curl --silent --show-error --fail "${health_url}")"

if [[ "${response}" != *'"status":"ok"'* ]]; then
  echo "[health] unexpected response from ${health_url}: ${response}" >&2
  exit 1
fi

printf '[health] ok %s\n' "${health_url}"
