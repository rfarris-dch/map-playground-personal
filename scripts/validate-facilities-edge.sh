#!/usr/bin/env bash
set -euo pipefail

base_url="${MAP_EDGE_BASE_URL:-${1:-}}"
distribution_id="${MAP_EDGE_DISTRIBUTION_ID:-}"
origin_alb_arn="${MAP_EDGE_ORIGIN_ALB_ARN:-}"
origin_region="${MAP_EDGE_ORIGIN_REGION:-us-east-2}"
facilities_bbox_colocation="${MAP_EDGE_FACILITIES_BBOX_COLOCATION:--77.75,38.55,-76.85,39.15}"
facilities_selection_geometry="${MAP_EDGE_FACILITIES_SELECTION_GEOMETRY:-{\"type\":\"Polygon\",\"coordinates\":[[[-77.55,38.65],[-76.95,38.65],[-76.95,39.05],[-77.55,39.05],[-77.55,38.65]]]}}"

if [[ -z "${base_url}" ]]; then
  echo "[edge] missing MAP_EDGE_BASE_URL or first positional base URL argument" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "[edge] aws CLI is required" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "[edge] bun is required" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[edge] curl is required" >&2
  exit 1
fi

json_eval() {
  local expression="$1"

  bun -e '
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

curl_capture() {
  local headers_file="$1"
  local body_file="$2"
  shift 2
  curl \
    --silent \
    --show-error \
    --fail \
    --dump-header "${headers_file}" \
    --output "${body_file}" \
    "$@"
}

read_header() {
  local headers_file="$1"
  local header_name="$2"

  bun -e '
const fs = require("node:fs");
const headers = fs.readFileSync(process.argv[1], "utf8");
const target = process.argv[2].toLowerCase();
for (const line of headers.split(/\r?\n/)) {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) {
    continue;
  }
  const name = line.slice(0, separatorIndex).trim().toLowerCase();
  if (name !== target) {
    continue;
  }
  const value = line.slice(separatorIndex + 1).trim();
  process.stdout.write(value);
  process.exit(0);
}
process.exit(1);
' "${headers_file}" "${header_name}"
}

wait_for_cloudfront_status() {
  local expected_status="$1"
  local max_attempts="$2"

  if [[ -z "${distribution_id}" ]]; then
    return 0
  fi

  local status=""
  for attempt in $(seq 1 "${max_attempts}"); do
    status="$(
      aws cloudfront get-distribution \
        --id "${distribution_id}" \
        --query 'Distribution.Status' \
        --output text
    )"
    if [[ "${status}" == "${expected_status}" ]]; then
      printf '[edge] distribution %s status=%s\n' "${distribution_id}" "${status}"
      return 0
    fi

    if [[ "${attempt}" -lt "${max_attempts}" ]]; then
      sleep 10
    fi
  done

  echo "[edge] distribution ${distribution_id} did not reach status ${expected_status}; last status=${status}" >&2
  exit 1
}

assert_cloudfront_waf() {
  if [[ -z "${distribution_id}" ]]; then
    return 0
  fi

  local web_acl_id=""
  web_acl_id="$(
    aws cloudfront get-distribution \
      --id "${distribution_id}" \
      --query 'Distribution.DistributionConfig.WebACLId' \
      --output text
  )"
  if [[ -z "${web_acl_id}" || "${web_acl_id}" == "None" ]]; then
    echo "[edge] distribution ${distribution_id} is missing a CloudFront WAF association" >&2
    exit 1
  fi

  printf '[edge] cloudfront waf ok %s\n' "${web_acl_id}"
}

assert_origin_waf() {
  if [[ -z "${origin_alb_arn}" ]]; then
    return 0
  fi

  local web_acl_arn=""
  web_acl_arn="$(
    aws wafv2 get-web-acl-for-resource \
      --resource-arn "${origin_alb_arn}" \
      --region "${origin_region}" \
      --query 'WebACL.ARN' \
      --output text
  )"
  if [[ -z "${web_acl_arn}" || "${web_acl_arn}" == "None" ]]; then
    echo "[edge] origin ${origin_alb_arn} is missing a regional WAF association" >&2
    exit 1
  fi

  printf '[edge] origin waf ok %s\n' "${web_acl_arn}"
}

assert_cloudfront_hit() {
  local url="$1"
  local headers_file=""
  local body_file=""
  local x_cache=""
  local age_header=""

  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  for attempt in $(seq 1 3); do
    curl_capture "${headers_file}" "${body_file}" "${url}"
    x_cache="$(read_header "${headers_file}" "x-cache" || true)"
    age_header="$(read_header "${headers_file}" "age" || true)"
    if [[ "${x_cache}" == *"Hit from cloudfront"* || "${x_cache}" == *"RefreshHit from cloudfront"* ]]; then
      rm -f "${headers_file}" "${body_file}"
      printf '[edge] cache hit ok %s (%s, age=%s)\n' "${url}" "${x_cache}" "${age_header:-0}"
      return 0
    fi

    if [[ "${attempt}" -lt 3 ]]; then
      sleep 2
    fi
  done

  rm -f "${headers_file}" "${body_file}"
  echo "[edge] expected CloudFront cache hit for ${url}, last x-cache=${x_cache:-<missing>}" >&2
  exit 1
}

wait_for_cloudfront_status "Deployed" 30
assert_cloudfront_waf
assert_origin_waf

manifest_headers="$(mktemp)"
manifest_body="$(mktemp)"
bbox_headers="$(mktemp)"
bbox_body="$(mktemp)"
selection_headers="$(mktemp)"
selection_body="$(mktemp)"
trap 'rm -f "${manifest_headers}" "${manifest_body}" "${bbox_headers}" "${bbox_body}" "${selection_headers}" "${selection_body}"' EXIT

curl_capture "${manifest_headers}" "${manifest_body}" "${base_url}/api/geo/facilities/manifest"
dataset_version="$(json_eval 'data.current?.version' < "${manifest_body}")"
manifest_cache_control="$(read_header "${manifest_headers}" "cache-control" || true)"
manifest_dataset_header="$(read_header "${manifest_headers}" "x-dataset-version" || true)"
if [[ -z "${dataset_version}" ]]; then
  echo "[edge] manifest response did not include current.version" >&2
  exit 1
fi
if [[ "${manifest_dataset_header}" != "${dataset_version}" ]]; then
  echo "[edge] manifest x-dataset-version did not match current.version" >&2
  exit 1
fi
printf '[edge] manifest ok version=%s cache-control=%s\n' "${dataset_version}" "${manifest_cache_control}"
assert_cloudfront_hit "${base_url}/api/geo/facilities/manifest"

bbox_url="${base_url}/api/geo/facilities?bbox=${facilities_bbox_colocation}&perspective=colocation&limit=25&v=${dataset_version}"
curl_capture "${bbox_headers}" "${bbox_body}" "${bbox_url}"
bbox_feature_count="$(json_eval 'Array.isArray(data.features) ? data.features.length : -1' < "${bbox_body}")"
bbox_cache_status="$(read_header "${bbox_headers}" "x-cache-status" || true)"
bbox_dataset_header="$(read_header "${bbox_headers}" "x-dataset-version" || true)"
if [[ "${bbox_feature_count}" -le 0 ]]; then
  echo "[edge] bbox response returned no facilities" >&2
  exit 1
fi
if [[ "${bbox_dataset_header}" != "${dataset_version}" ]]; then
  echo "[edge] bbox x-dataset-version did not match manifest dataset version" >&2
  exit 1
fi
printf '[edge] bbox ok count=%s origin-cache-status=%s\n' "${bbox_feature_count}" "${bbox_cache_status}"
assert_cloudfront_hit "${bbox_url}"

curl_capture \
  "${selection_headers}" \
  "${selection_body}" \
  -X POST \
  -H "content-type: application/json" \
  -H "x-dataset-version: ${dataset_version}" \
  --data "{\"geometry\":${facilities_selection_geometry},\"perspectives\":[\"colocation\",\"hyperscale\"],\"limitPerPerspective\":25}" \
  "${base_url}/api/geo/facilities/selection"
selection_type="$(json_eval 'data.type' < "${selection_body}")"
selection_cache_control="$(read_header "${selection_headers}" "cache-control" || true)"
if [[ "${selection_type}" != "FeatureCollection" ]]; then
  echo "[edge] selection response type was ${selection_type}" >&2
  exit 1
fi
if [[ "${selection_cache_control}" != "no-store" ]]; then
  echo "[edge] selection Cache-Control expected no-store, got ${selection_cache_control}" >&2
  exit 1
fi
printf '[edge] selection ok cache-control=%s\n' "${selection_cache_control}"
