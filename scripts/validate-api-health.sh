#!/usr/bin/env bash
set -euo pipefail

health_url="${MAP_API_HEALTH_URL:-http://127.0.0.1:${PORT:-3001}/api/health}"
max_attempts="${MAP_API_HEALTH_MAX_ATTEMPTS:-20}"
retry_delay_seconds="${MAP_API_HEALTH_RETRY_DELAY_SECONDS:-2}"
api_base_url="${MAP_API_BASE_URL:-${health_url%/api/health}}"

if [[ "${api_base_url}" == "${health_url}" ]]; then
  api_base_url="${health_url%/health}"
fi

facilities_manifest_url="${MAP_API_FACILITIES_MANIFEST_URL:-${api_base_url}/api/geo/facilities/manifest}"
facilities_bbox_colocation="${MAP_API_FACILITIES_BBOX_COLOCATION:--77.75,38.55,-76.85,39.15}"
facilities_bbox_hyperscale="${MAP_API_FACILITIES_BBOX_HYPERSCALE:--77.75,38.55,-76.85,39.15}"
facilities_selection_geometry="${MAP_API_FACILITIES_SELECTION_GEOMETRY:-{\"type\":\"Polygon\",\"coordinates\":[[[-77.55,38.65],[-76.95,38.65],[-76.95,39.05],[-77.55,39.05],[-77.55,38.65]]]}}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[health] curl is required to validate the API health endpoint" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[health] node is required for facilities smoke checks" >&2
  exit 1
fi

json_eval() {
  local expression="$1"

  node -e '
const fs = require("node:fs");
const input = fs.readFileSync(0, "utf8");
const data = JSON.parse(input);
const evaluate = new Function("data", `return (${process.argv[1]});`);
const value = evaluate(data);
if (typeof value === "undefined") {
  process.exit(2);
}
if (typeof value === "string") {
  process.stdout.write(value);
  process.exit(0);
}
process.stdout.write(JSON.stringify(value));
' "${expression}"
}

curl_json() {
  local output_file="$1"
  shift
  curl --silent --show-error --fail "$@" > "${output_file}"
}

response=""
health_ok="false"
for attempt in $(seq 1 "${max_attempts}"); do
  response="$(curl --silent --show-error --fail "${health_url}" 2>/dev/null || true)"
  if [[ "${response}" == *'"status":"ok"'* ]]; then
    printf '[health] ok %s\n' "${health_url}"
    health_ok="true"
    break
  fi

  if [[ "${attempt}" -lt "${max_attempts}" ]]; then
    sleep "${retry_delay_seconds}"
  fi
done

if [[ -z "${response}" ]]; then
  echo "[health] failed to reach ${health_url} after ${max_attempts} attempts" >&2
  exit 1
fi

if [[ "${health_ok}" != "true" ]]; then
  echo "[health] unexpected response from ${health_url}: ${response}" >&2
  exit 1
fi

manifest_file="$(mktemp)"
colocation_file="$(mktemp)"
hyperscale_file="$(mktemp)"
detail_file="$(mktemp)"
selection_file="$(mktemp)"
trap 'rm -f "${manifest_file}" "${colocation_file}" "${hyperscale_file}" "${detail_file}" "${selection_file}"' EXIT

curl_json "${manifest_file}" "${facilities_manifest_url}"
dataset_version="$(json_eval 'data.current?.version' < "${manifest_file}")"
if [[ -z "${dataset_version}" ]]; then
  echo "[health] facilities manifest did not include current.version" >&2
  exit 1
fi
printf '[health] facilities manifest ok %s (version=%s)\n' "${facilities_manifest_url}" "${dataset_version}"

curl_json \
  "${colocation_file}" \
  "${api_base_url}/api/geo/facilities?bbox=${facilities_bbox_colocation}&perspective=colocation&limit=25&v=${dataset_version}"
colocation_feature_count="$(json_eval 'Array.isArray(data.features) ? data.features.length : -1' < "${colocation_file}")"
colocation_detail_id="$(json_eval 'data.features?.[0]?.properties?.facilityId ?? data.features?.[0]?.id ?? ""' < "${colocation_file}")"
if [[ "${colocation_feature_count}" -le 0 || -z "${colocation_detail_id}" ]]; then
  echo "[health] colocation bbox returned no facility usable for detail validation" >&2
  exit 1
fi
printf '[health] facilities bbox ok colocation count=%s\n' "${colocation_feature_count}"

curl_json \
  "${hyperscale_file}" \
  "${api_base_url}/api/geo/facilities?bbox=${facilities_bbox_hyperscale}&perspective=hyperscale&limit=25&v=${dataset_version}"
hyperscale_feature_count="$(json_eval 'Array.isArray(data.features) ? data.features.length : -1' < "${hyperscale_file}")"
if [[ "${hyperscale_feature_count}" -le 0 ]]; then
  echo "[health] hyperscale bbox returned no facilities" >&2
  exit 1
fi
printf '[health] facilities bbox ok hyperscale count=%s\n' "${hyperscale_feature_count}"

curl_json \
  "${detail_file}" \
  "${api_base_url}/api/geo/facilities/${colocation_detail_id}?perspective=colocation&v=${dataset_version}"
detail_feature_id="$(json_eval 'data.feature?.properties?.facilityId ?? data.feature?.id' < "${detail_file}")"
if [[ "${detail_feature_id}" != "${colocation_detail_id}" ]]; then
  echo "[health] facilities detail returned unexpected facility id" >&2
  exit 1
fi
printf '[health] facilities detail ok facilityId=%s\n' "${detail_feature_id}"

curl_json \
  "${selection_file}" \
  -X POST \
  -H "content-type: application/json" \
  -H "x-dataset-version: ${dataset_version}" \
  --data "{\"geometry\":${facilities_selection_geometry},\"perspectives\":[\"colocation\",\"hyperscale\"],\"limitPerPerspective\":25}" \
  "${api_base_url}/api/geo/facilities/selection"
selection_type="$(json_eval 'data.type' < "${selection_file}")"
if [[ "${selection_type}" != "FeatureCollection" ]]; then
  echo "[health] facilities selection returned unexpected payload type: ${selection_type}" >&2
  exit 1
fi
printf '[health] facilities selection ok\n'
