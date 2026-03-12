#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
target_dir="${1:-${repo_root}/apps/api/dist}"

if [[ ! -d "${target_dir}" ]]; then
  echo "[build] API dist directory does not exist: ${target_dir}" >&2
  exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "[build] rg is required to normalize API dist imports" >&2
  exit 1
fi

mapfile -t matched_files < <(
  rg -l 'from "(\./|\.\./)+effect"' "${target_dir}" --glob '*.js' --glob '*.d.ts'
)

if [[ "${#matched_files[@]}" -eq 0 ]]; then
  echo "[build] API dist imports already normalized"
  exit 0
fi

for matched_file in "${matched_files[@]}"; do
  perl -0pi -e 's/from "(?:\.\/|\.\.\/)+effect"/from "effect"/g' "${matched_file}"
done

printf '[build] normalized external effect imports in %s file(s)\n' "${#matched_files[@]}"
