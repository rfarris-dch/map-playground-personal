#!/usr/bin/env bash
set -euo pipefail

deploy_root="/home/deploy/map"
deploy_runtime_path="/home/deploy/.bun/bin:/usr/local/bin:/usr/bin:/bin"
env_file="/etc/map-app/map-api.env"
nginx_conf_source="${deploy_root}/aws/app/nginx/map-app.conf"
nginx_conf_target="/etc/nginx/conf.d/map-app.conf"
required_api_port="3001"
required_bun_version="1.3.6"
required_fiber_locator_source_mode="external-xyz"
service_source="${deploy_root}/aws/app/systemd/map-api.service"
service_target="/etc/systemd/system/map-api.service"

read_env_value() {
  local key="${1}"
  local line

  line="$(grep -E "^${key}=" "${env_file}" | head -n 1 || true)"
  if [[ -z "${line}" ]]; then
    return 1
  fi

  printf '%s' "${line#*=}"
}

escape_sed_replacement() {
  printf '%s' "${1}" | sed -e 's/[\/&|]/\\&/g'
}

if ! id -u deploy >/dev/null 2>&1; then
  echo "[deploy] deploy user is required before CodeDeploy runs" >&2
  exit 1
fi

current_bun_version="$(su -s /bin/sh deploy -c "PATH='${deploy_runtime_path}' bun --version" 2>/dev/null || echo "none")"
if [[ "${current_bun_version}" != "${required_bun_version}" ]]; then
  echo "[deploy] upgrading bun for deploy user from ${current_bun_version} to ${required_bun_version}" >&2
  su -s /bin/sh deploy -c "curl -fsSL https://bun.sh/install | bash -s -- 'bun-v${required_bun_version}'"
  current_bun_version="$(su -s /bin/sh deploy -c "PATH='${deploy_runtime_path}' bun --version" 2>/dev/null || echo "none")"
  if [[ "${current_bun_version}" != "${required_bun_version}" ]]; then
    echo "[deploy] bun upgrade failed for deploy user, got ${current_bun_version}" >&2
    exit 1
  fi
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "[deploy] nginx is required on the EC2 host" >&2
  exit 1
fi

if [[ ! -f "${env_file}" ]]; then
  echo "[deploy] missing runtime env file: ${env_file}" >&2
  exit 1
fi

configured_port="$(awk -F= '$1 == "PORT" { print $2; exit }' "${env_file}" | tr -d '[:space:]')"
if [[ -n "${configured_port}" && "${configured_port}" != "${required_api_port}" ]]; then
  echo "[deploy] ${env_file} must set PORT=${required_api_port} for this deployment shape" >&2
  exit 1
fi

configured_fiber_locator_source_mode="$(read_env_value "FIBER_LOCATOR_SOURCE_MODE" || true)"
configured_fiber_locator_source_mode="$(printf '%s' "${configured_fiber_locator_source_mode}" | tr -d '[:space:]')"
if [[ "${configured_fiber_locator_source_mode}" != "${required_fiber_locator_source_mode}" ]]; then
  echo "[deploy] ${env_file} must set FIBER_LOCATOR_SOURCE_MODE=${required_fiber_locator_source_mode}" >&2
  exit 1
fi

origin_auth_value="$(read_env_value "MAP_ORIGIN_AUTH_HEADER_VALUE" || true)"
origin_auth_value="$(printf '%s' "${origin_auth_value}" | tr -d '\r')"
if [[ -z "${origin_auth_value}" ]]; then
  echo "[deploy] ${env_file} is missing required runtime value: MAP_ORIGIN_AUTH_HEADER_VALUE" >&2
  exit 1
fi

for required_var in DATABASE_URL FIBER_LOCATOR_SOURCE_MODE FIBERLOCATOR_API_BASE_URL FIBERLOCATOR_STATIC_TOKEN FIBERLOCATOR_LINE_IDS MAP_APP_AUTH_ALLOWED_EMAIL_DOMAIN MAP_APP_AUTH_IAM_BASE_URL MAP_APP_AUTH_SESSION_COOKIE_NAME MAP_APP_AUTH_SESSION_SECRET MAP_ORIGIN_AUTH_HEADER_VALUE; do
  if [[ -z "$(read_env_value "${required_var}" || true)" ]]; then
    echo "[deploy] ${env_file} is missing required runtime value: ${required_var}" >&2
    exit 1
  fi
done

cd "${deploy_root}"
install -m 0644 "${service_source}" "${service_target}"
sed \
  "s|__MAP_ORIGIN_AUTH_HEADER_VALUE__|$(escape_sed_replacement "${origin_auth_value}")|g" \
  "${nginx_conf_source}" > "${nginx_conf_target}"
chmod 0644 "${nginx_conf_target}"

find "${deploy_root}/scripts" -type f -name '*.sh' -exec chmod 755 {} +
chown -R deploy:deploy "${deploy_root}"

if ! su -s /bin/sh deploy -c "cd '${deploy_root}' && PATH='${deploy_runtime_path}' bun install --frozen-lockfile"; then
  echo "[deploy] bun install failed inside the staged artifact tree" >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable map-api.service
nginx -t
