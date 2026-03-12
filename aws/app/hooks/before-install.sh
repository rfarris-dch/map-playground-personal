#!/usr/bin/env bash
set -euo pipefail

deploy_root="/home/deploy/map"
runtime_env_dir="/etc/map-app"
log_dir="/var/log/map-app"

if ! id -u deploy >/dev/null 2>&1; then
  echo "[deploy] deploy user is required before CodeDeploy runs" >&2
  exit 1
fi

install -d -o deploy -g deploy "${deploy_root}"
install -d -o root -g root "${runtime_env_dir}"
install -d -o deploy -g deploy "${log_dir}"

if systemctl list-unit-files | grep -q '^map-api\.service'; then
  systemctl stop map-api.service || true
fi

rm -rf \
  "${deploy_root}/apps" \
  "${deploy_root}/packages" \
  "${deploy_root}/scripts" \
  "${deploy_root}/aws"

rm -f \
  "${deploy_root}/appspec.yml" \
  "${deploy_root}/bun.lock" \
  "${deploy_root}/package.json" \
  "${deploy_root}/turbo.json"
