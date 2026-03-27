#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-2}"
WORKER_NAME="${MAP_FLOOD_WORKER_NAME:-dch-playground-flood-build-worker}"
WORKER_USER="${MAP_FLOOD_WORKER_USER:-ec2-user}"
WORKER_KEY_PATH="${MAP_FLOOD_WORKER_KEY_PATH:-${HOME}/.ssh/dch-playground-map-app.pem}"
WORKER_REPO_ROOT="${MAP_FLOOD_WORKER_REPO_ROOT:-/opt/map-flood-build/repo}"

resolve_worker_host() {
  local host
  host="$(
    aws ec2 describe-instances \
      --region "${AWS_REGION}" \
      --filters \
        "Name=tag:Name,Values=${WORKER_NAME}" \
        "Name=instance-state-name,Values=running" \
      --query 'Reservations[].Instances[].PublicIpAddress' \
      --output text
  )"
  host="${host%%[[:space:]]*}"
  if [[ -z "${host}" || "${host}" == "None" ]]; then
    echo "[flood-worker-sync] ERROR: no running worker found for ${WORKER_NAME} in ${AWS_REGION}" >&2
    exit 1
  fi
  printf '%s\n' "${host}"
}

for bin in aws rsync ssh; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[flood-worker-sync] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ ! -f "${WORKER_KEY_PATH}" ]]; then
  echo "[flood-worker-sync] ERROR: worker key not found: ${WORKER_KEY_PATH}" >&2
  exit 1
fi

WORKER_HOST="$(resolve_worker_host)"
SSH_OPTIONS=(-o StrictHostKeyChecking=no -i "${WORKER_KEY_PATH}")

ssh "${SSH_OPTIONS[@]}" "${WORKER_USER}@${WORKER_HOST}" \
  "set -euo pipefail; rm -rf '${WORKER_REPO_ROOT}'; mkdir -p '${WORKER_REPO_ROOT}/apps/web'"

rsync -az \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.cache' \
  --exclude 'var' \
  --exclude 'dist' \
  --exclude 'coverage' \
  -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
  "${ROOT_DIR}/package.json" \
  "${ROOT_DIR}/bun.lock" \
  "${ROOT_DIR}/biome.json" \
  "${ROOT_DIR}/tsconfig.json" \
  "${ROOT_DIR}/tsconfig.base.json" \
  "${ROOT_DIR}/turbo.json" \
  "${ROOT_DIR}/packages" \
  "${ROOT_DIR}/scripts" \
  "${ROOT_DIR}/config" \
  "${ROOT_DIR}/tools" \
  "${ROOT_DIR}/apps/api" \
  "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/"

rsync -az \
  -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
  "${ROOT_DIR}/apps/web/package.json" \
  "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/apps/web/"

if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  rsync -az \
    -e "ssh -o StrictHostKeyChecking=no -i ${WORKER_KEY_PATH}" \
    "${ROOT_DIR}/apps/api/.env" \
    "${WORKER_USER}@${WORKER_HOST}:${WORKER_REPO_ROOT}/apps/api/"
fi

ssh "${SSH_OPTIONS[@]}" "${WORKER_USER}@${WORKER_HOST}" "
set -euo pipefail
source /etc/profile.d/map-flood-build.sh
cd '${WORKER_REPO_ROOT}'
export PATH='/home/ec2-user/.duckdb/cli/latest:/home/ec2-user/.bun/bin:/root/.bun/bin:${PATH}'
if ! command -v duckdb >/dev/null 2>&1; then
  curl -fsSL https://install.duckdb.org | sh
fi
bun install
bash ./scripts/install-planetiler.sh
command -v duckdb >/dev/null
command -v bun >/dev/null
command -v java >/dev/null
command -v ogr2ogr >/dev/null
"

echo "[flood-worker-sync] host=${WORKER_HOST} repo=${WORKER_REPO_ROOT}" >&2
