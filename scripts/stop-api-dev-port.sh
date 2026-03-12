#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_env_file="${root_dir}/apps/api/.env"

read_api_port() {
  local port="3001"

  if [[ -f "${api_env_file}" ]]; then
    local configured_port
    configured_port="$(
      awk -F= '
        $1 == "PORT" {
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
          print $2
          exit
        }
      ' "${api_env_file}"
    )"

    if [[ -n "${configured_port}" ]]; then
      port="${configured_port}"
    fi
  fi

  printf '%s\n' "${port}"
}

resolve_port() {
  local target="${1}"

  case "${target}" in
    api)
      read_api_port
      ;;
    web)
      printf '%s\n' "${MAP_WEB_PORT:-5143}"
      ;;
    pipeline-monitor)
      printf '%s\n' "${MAP_PIPELINE_MONITOR_PORT:-5144}"
      ;;
    docs)
      printf '%s\n' "${MAP_DOCS_PORT:-5145}"
      ;;
    ''|*[!0-9]*)
      echo "[dev] unknown port target: ${target}" >&2
      exit 1
      ;;
    *)
      printf '%s\n' "${target}"
      ;;
  esac
}

if ! command -v lsof >/dev/null 2>&1; then
  echo "[dev] lsof is unavailable; skipping port cleanup"
  exit 0
fi

if ! command -v ps >/dev/null 2>&1; then
  echo "[dev] ps is unavailable; skipping port cleanup"
  exit 0
fi

if ! command -v pgrep >/dev/null 2>&1; then
  echo "[dev] pgrep is unavailable; skipping port cleanup"
  exit 0
fi

print_unique_lines() {
  awk 'NF { print }' | sort -u
}

command_for_pid() {
  local pid="${1}"
  ps -o command= -p "${pid}" 2>/dev/null | sed 's/^[[:space:]]*//'
}

ppid_for_pid() {
  local pid="${1}"
  ps -o ppid= -p "${pid}" 2>/dev/null | tr -d ' '
}

is_dev_process_command() {
  local command="${1}"

  [[ "${command}" == *"${root_dir}"* ]] || [[ "${command}" == *"turbo run dev"* ]]
}

collect_descendant_pids() {
  local parent_pid="${1}"
  local child_pids
  child_pids="$(pgrep -P "${parent_pid}" || true)"

  if [[ -z "${child_pids}" ]]; then
    return
  fi

  while IFS= read -r child_pid; do
    [[ -n "${child_pid}" ]] || continue
    printf '%s\n' "${child_pid}"
    collect_descendant_pids "${child_pid}"
  done <<< "${child_pids}"
}

collect_ancestor_pids() {
  local pid="${1}"
  local current_pid
  current_pid="$(ppid_for_pid "${pid}")"

  while [[ -n "${current_pid}" && "${current_pid}" != "1" ]]; do
    local command
    command="$(command_for_pid "${current_pid}")"

    if ! is_dev_process_command "${command}"; then
      break
    fi

    printf '%s\n' "${current_pid}"
    current_pid="$(ppid_for_pid "${current_pid}")"
  done
}

collect_listener_pids() {
  local port="${1}"
  {
    lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
    lsof -tiTCP:"${port}" 2>/dev/null || true
  } | print_unique_lines
}

collect_repo_dev_pids() {
  {
    pgrep -f "${root_dir}.*turbo run dev" || true
    pgrep -f "${root_dir}/apps/api/src/index.ts" || true
  } | print_unique_lines
}

collect_target_pids() {
  local port="${1}"
  local listener_pids
  listener_pids="$(collect_listener_pids "${port}")"

  if [[ -n "${listener_pids}" ]]; then
    while IFS= read -r listener_pid; do
      [[ -n "${listener_pid}" ]] || continue
      printf '%s\n' "${listener_pid}"
      collect_descendant_pids "${listener_pid}"
      collect_ancestor_pids "${listener_pid}"
    done <<< "${listener_pids}"
  fi

  collect_repo_dev_pids
}

kill_pid_set() {
  local signal="${1}"
  shift

  if [[ "${#}" -eq 0 ]]; then
    return
  fi

  local pid
  for pid in "$@"; do
    kill -"${signal}" "${pid}" >/dev/null 2>&1 || true
  done
}

stop_port() {
  local port="${1}"
  local target_pids=""
  local pid_array=()
  local attempt

  for attempt in $(seq 1 8); do
    target_pids="$(collect_target_pids "${port}")"
    if [[ -z "${target_pids}" ]]; then
      return
    fi

    mapfile -t pid_array < <(printf '%s\n' "${target_pids}" | print_unique_lines)
    if [[ "${#pid_array[@]}" -eq 0 ]]; then
      return
    fi

    echo "[dev] stopping process tree for port ${port}: ${pid_array[*]}"
    kill_pid_set TERM "${pid_array[@]}"
    sleep 0.5
  done

  for attempt in $(seq 1 8); do
    target_pids="$(collect_target_pids "${port}")"
    if [[ -z "${target_pids}" ]]; then
      return
    fi

    mapfile -t pid_array < <(printf '%s\n' "${target_pids}" | print_unique_lines)
    if [[ "${#pid_array[@]}" -eq 0 ]]; then
      return
    fi

    echo "[dev] force killing process tree for port ${port}: ${pid_array[*]}"
    kill_pid_set KILL "${pid_array[@]}"
    sleep 0.25
  done

  echo "[dev] failed to clear port ${port}" >&2
  exit 1
}

main() {
  local targets=()

  if [[ "${#}" -eq 0 ]]; then
    targets=("api")
  else
    targets=("$@")
  fi

  local ports=()
  local target
  for target in "${targets[@]}"; do
    if [[ "${target}" == "all" ]]; then
      ports+=("$(read_api_port)" "${MAP_WEB_PORT:-5143}" "${MAP_PIPELINE_MONITOR_PORT:-5144}" "${MAP_DOCS_PORT:-5145}" "3000")
      continue
    fi

    ports+=("$(resolve_port "${target}")")
  done

  mapfile -t ports < <(printf '%s\n' "${ports[@]}" | print_unique_lines)
  local port
  for port in "${ports[@]}"; do
    [[ -n "${port}" ]] || continue
    stop_port "${port}"
  done
}

main "$@"
