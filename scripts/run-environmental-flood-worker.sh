#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${1:-}"
AWS_REGION="${AWS_REGION:-us-east-2}"
WORKER_NAME="${MAP_FLOOD_WORKER_NAME:-dch-playground-flood-build-worker}"
WORKER_USER="${MAP_FLOOD_WORKER_USER:-ec2-user}"
WORKER_KEY_PATH="${MAP_FLOOD_WORKER_KEY_PATH:-${HOME}/.ssh/dch-playground-map-app.pem}"
WORKER_REPO_ROOT="${MAP_FLOOD_WORKER_REPO_ROOT:-/opt/map-flood-build/repo}"
WORKER_SCRATCH_ROOT="${MAP_FLOOD_WORKER_SCRATCH_ROOT:-/mnt/flood-build}"
APP_HOST_NAME="${MAP_APP_HOST_NAME:-dch-playground-map-app}"
APP_HOST_USER="${MAP_APP_HOST_USER:-ec2-user}"
ARTIFACT_BUCKET="${MAP_FLOOD_WORKER_ARTIFACT_BUCKET:-dch-playground-artifacts-067665647218}"

resolve_instance_host() {
  local instance_name="${1}"
  local host
  host="$(
    aws ec2 describe-instances \
      --region "${AWS_REGION}" \
      --filters \
        "Name=tag:Name,Values=${instance_name}" \
        "Name=instance-state-name,Values=running" \
      --query 'Reservations[].Instances[].PublicIpAddress' \
      --output text
  )"
  host="${host%%[[:space:]]*}"
  if [[ -z "${host}" || "${host}" == "None" ]]; then
    echo "[flood-worker-run] ERROR: no running instance found for ${instance_name} in ${AWS_REGION}" >&2
    exit 1
  fi
  printf '%s\n' "${host}"
}

read_database_url_from_app_host() {
  local app_host="${1}"
  ssh -o StrictHostKeyChecking=no -i "${WORKER_KEY_PATH}" "${APP_HOST_USER}@${app_host}" \
    "sudo grep -E '^(DATABASE_URL|POSTGRES_URL)=' /etc/map-app/map-api.env | head -n 1 | cut -d= -f2-"
}

for bin in aws python3 rsync ssh; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[flood-worker-run] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ -z "${RUN_ID}" ]]; then
  echo "[flood-worker-run] ERROR: usage: scripts/run-environmental-flood-worker.sh <run-id>" >&2
  exit 1
fi

if [[ ! -f "${WORKER_KEY_PATH}" ]]; then
  echo "[flood-worker-run] ERROR: worker key not found: ${WORKER_KEY_PATH}" >&2
  exit 1
fi

RUN_DIR="${ROOT_DIR}/var/environmental-sync/environmental-flood/${RUN_ID}"
RUN_SUMMARY_PATH="${RUN_DIR}/run-summary.json"
RUN_CONFIG_PATH="${RUN_DIR}/run-config.json"
LOCAL_PM_DIR="${ROOT_DIR}/.cache/tiles/environmental-flood"
LOCAL_PM_PATH="${LOCAL_PM_DIR}/environmental-flood_${RUN_ID}.pmtiles"

if [[ ! -f "${RUN_CONFIG_PATH}" ]]; then
  echo "[flood-worker-run] ERROR: run config not found: ${RUN_CONFIG_PATH}" >&2
  exit 1
fi

STAGE_PREFIX="flood-build/${RUN_ID}"
RESULTS_PREFIX="s3://${ARTIFACT_BUCKET}/${STAGE_PREFIX}/results"
REMOTE_OUTPUT_ROOT="${WORKER_SCRATCH_ROOT}/tilesources/environmental-flood/${RUN_ID}"
REMOTE_TILES_OUT_DIR="${WORKER_SCRATCH_ROOT}/tiles/environmental-flood"
REMOTE_PMTILES_PATH="${REMOTE_TILES_OUT_DIR}/environmental-flood_${RUN_ID}.pmtiles"
SSH_OPTIONS=(-o StrictHostKeyChecking=no -i "${WORKER_KEY_PATH}")
WORKER_HOST="$(resolve_instance_host "${WORKER_NAME}")"
APP_HOST="$(resolve_instance_host "${APP_HOST_NAME}")"
DATABASE_URL="$(read_database_url_from_app_host "${APP_HOST}")"

if [[ -z "${DATABASE_URL}" ]]; then
  echo "[flood-worker-run] ERROR: could not read DATABASE_URL from ${APP_HOST_NAME}" >&2
  exit 1
fi

REMOTE_DATABASE_URL="$(printf '%q' "${DATABASE_URL}")"

bash "${ROOT_DIR}/scripts/sync-flood-build-worker.sh"

ssh "${SSH_OPTIONS[@]}" "${WORKER_USER}@${WORKER_HOST}" "
set -euo pipefail
mkdir -p '${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}'
mkdir -p '${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/manifests'
"

rsync_paths=("${RUN_CONFIG_PATH}")
if [[ -f "${RUN_SUMMARY_PATH}" ]]; then
  rsync_paths+=("${RUN_SUMMARY_PATH}")
fi

rsync -az \
  -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
  "${rsync_paths[@]}" \
  "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/"

if [[ -f "${RUN_DIR}/manifests/lake-manifest.json" ]]; then
  rsync -az \
    -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
    "${RUN_DIR}/manifests/lake-manifest.json" \
    "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/manifests/"
fi

ssh "${SSH_OPTIONS[@]}" "${WORKER_USER}@${WORKER_HOST}" "
set -euo pipefail
source /etc/profile.d/map-flood-build.sh
cd '${WORKER_REPO_ROOT}'
export PATH='/home/ec2-user/.duckdb/cli/latest:/home/ec2-user/.bun/bin:/root/.bun/bin:${PATH}'
export DATABASE_URL=${REMOTE_DATABASE_URL}
export POSTGRES_URL=${REMOTE_DATABASE_URL}
export ENVIRONMENTAL_FLOOD_DATABASE_URL=${REMOTE_DATABASE_URL}
mkdir -p '${REMOTE_OUTPUT_ROOT}' '${REMOTE_TILES_OUT_DIR}'
bun run ./scripts/refresh-environmental-flood.ts \
  --run-id='${RUN_ID}' \
  --step=export-geoparquet
bun run ./scripts/export-environmental-planetiler-inputs.ts \
  --dataset=environmental-flood \
  --run-id='${RUN_ID}' \
  --overlay-kind=all \
  --output-root='${REMOTE_OUTPUT_ROOT}'
bun run ./scripts/validate-environmental-flood-parity.ts \
  --run-id='${RUN_ID}' \
  --overlay-kind=all \
  --output-root='${REMOTE_OUTPUT_ROOT}'
ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT='${REMOTE_OUTPUT_ROOT}' \
ENVIRONMENTAL_FLOOD_TILES_OUT_DIR='${REMOTE_TILES_OUT_DIR}' \
  bash ./scripts/build-environmental-flood-pmtiles.sh '${RUN_ID}'
aws s3 cp '${REMOTE_PMTILES_PATH}' '${RESULTS_PREFIX}/environmental-flood_${RUN_ID}.pmtiles'
"

mkdir -p "${RUN_DIR}/qa" "${RUN_DIR}/manifests" "${LOCAL_PM_DIR}"

rsync -az \
  -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
  "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/run-summary.json" \
  "${RUN_DIR}/"

if ssh "${SSH_OPTIONS[@]}" "${WORKER_USER}@${WORKER_HOST}" "test -f '${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/manifests/lake-manifest.json'"; then
  rsync -az \
    -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
    "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/manifests/lake-manifest.json" \
    "${RUN_DIR}/manifests/"
fi

if ssh "${SSH_OPTIONS[@]}" "${WORKER_USER}@${WORKER_HOST}" "test -f '${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/qa/assertions.parquet'"; then
  rsync -az \
    -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
    "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/qa/assertions.parquet" \
    "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/var/environmental-sync/environmental-flood/${RUN_ID}/qa/profile.parquet" \
    "${RUN_DIR}/qa/"
fi

aws s3 cp "${RESULTS_PREFIX}/environmental-flood_${RUN_ID}.pmtiles" "${LOCAL_PM_PATH}"

echo "[flood-worker-run] worker=${WORKER_HOST} runId=${RUN_ID} pmtiles=${LOCAL_PM_PATH}" >&2
