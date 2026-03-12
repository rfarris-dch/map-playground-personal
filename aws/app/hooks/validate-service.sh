#!/usr/bin/env bash
set -euo pipefail

deploy_root="/home/deploy/map"
api_health_script="${deploy_root}/scripts/validate-api-health.sh"
tile_delivery_contract="${deploy_root}/aws/app/tile-delivery.env"
tile_delivery_validator="${deploy_root}/scripts/validate-tile-delivery.ts"

retry_curl() {
  local url="${1}"

  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error "${url}" >/dev/null; then
      return 0
    fi

    sleep 2
  done

  echo "[deploy] failed to validate ${url}" >&2
  return 1
}

systemctl is-active --quiet map-api.service
systemctl is-active --quiet nginx

if [[ ! -x "${api_health_script}" ]]; then
  echo "[deploy] missing API health helper: ${api_health_script}" >&2
  exit 1
fi

if [[ ! -f "${tile_delivery_contract}" ]]; then
  echo "[deploy] missing tile delivery contract: ${tile_delivery_contract}" >&2
  exit 1
fi

if [[ ! -f "${tile_delivery_validator}" ]]; then
  echo "[deploy] missing tile delivery validator: ${tile_delivery_validator}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${tile_delivery_contract}"
set +a

PORT=3001 "${api_health_script}"
retry_curl "http://127.0.0.1/"
retry_curl "http://127.0.0.1/api/health"
retry_curl "http://127.0.0.1/api/geo/fiber-locator/layers"

bun "${tile_delivery_validator}" \
  --dataset="${MAP_TILE_PARCELS_DATASET}" \
  --manifest-url="${MAP_TILE_PARCELS_MANIFEST_URL}" \
  --expected-manifest-cache-control="${MAP_TILE_MANIFEST_CACHE_CONTROL}" \
  --expected-pmtiles-cache-control="${MAP_TILE_PMTILES_CACHE_CONTROL}"

if [[ -n "${MAP_TILE_ENVIRONMENTAL_FLOOD_MANIFEST_URL:-}" ]]; then
  bun "${tile_delivery_validator}" \
    --dataset="${MAP_TILE_ENVIRONMENTAL_FLOOD_DATASET}" \
    --manifest-url="${MAP_TILE_ENVIRONMENTAL_FLOOD_MANIFEST_URL}" \
    --expected-manifest-cache-control="${MAP_TILE_MANIFEST_CACHE_CONTROL}" \
    --expected-pmtiles-cache-control="${MAP_TILE_PMTILES_CACHE_CONTROL}"
fi

if [[ -n "${MAP_TILE_ENVIRONMENTAL_HYDRO_BASINS_MANIFEST_URL:-}" ]]; then
  bun "${tile_delivery_validator}" \
    --dataset="${MAP_TILE_ENVIRONMENTAL_HYDRO_BASINS_DATASET}" \
    --manifest-url="${MAP_TILE_ENVIRONMENTAL_HYDRO_BASINS_MANIFEST_URL}" \
    --expected-manifest-cache-control="${MAP_TILE_MANIFEST_CACHE_CONTROL}" \
    --expected-pmtiles-cache-control="${MAP_TILE_PMTILES_CACHE_CONTROL}"
fi
