#!/usr/bin/env bash
set -euo pipefail

health_url="${MAP_API_HEALTH_URL:-http://127.0.0.1:${PORT:-3001}/api/health}"
max_attempts="${MAP_API_HEALTH_MAX_ATTEMPTS:-20}"
retry_delay_seconds="${MAP_API_HEALTH_RETRY_DELAY_SECONDS:-2}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[health] curl is required to validate the API health endpoint" >&2
  exit 1
fi

response=""
for attempt in $(seq 1 "${max_attempts}"); do
  response="$(curl --silent --show-error --fail "${health_url}" 2>/dev/null || true)"
  if [[ "${response}" == *'"status":"ok"'* ]]; then
    printf '[health] ok %s\n' "${health_url}"
    exit 0
  fi

  if [[ "${attempt}" -lt "${max_attempts}" ]]; then
    sleep "${retry_delay_seconds}"
  fi
done

if [[ -z "${response}" ]]; then
  echo "[health] failed to reach ${health_url} after ${max_attempts} attempts" >&2
  exit 1
fi

echo "[health] unexpected response from ${health_url}: ${response}" >&2
exit 1
