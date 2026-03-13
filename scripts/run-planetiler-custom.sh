#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_PATH="${1:-}"
OUTPUT_PATH="${2:-}"
shift 2 || true

PLANETILER_VERSION="${PLANETILER_VERSION:-0.10.1}"
PLANETILER_JAR_PATH="${PLANETILER_JAR:-${ROOT_DIR}/tools/planetiler/planetiler-v${PLANETILER_VERSION}.jar}"
PLANETILER_JAVA_BIN="${PLANETILER_JAVA_BIN:-java}"
PLANETILER_JAVA_HEAP="${PLANETILER_JAVA_HEAP:-8g}"

if [[ -z "${SCHEMA_PATH}" || -z "${OUTPUT_PATH}" ]]; then
  echo "[planetiler] ERROR: usage: run-planetiler-custom.sh <schema-path> <output-path> [planetiler-args...]" >&2
  exit 1
fi

if ! command -v "${PLANETILER_JAVA_BIN}" >/dev/null 2>&1; then
  echo "[planetiler] ERROR: missing dependency in PATH: ${PLANETILER_JAVA_BIN}" >&2
  exit 1
fi

if [[ ! -f "${PLANETILER_JAR_PATH}" ]]; then
  echo "[planetiler] ERROR: Planetiler jar not found at ${PLANETILER_JAR_PATH}" >&2
  echo "[planetiler]        run: bash ./scripts/install-planetiler.sh" >&2
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"
rm -f "${OUTPUT_PATH}"

echo "[planetiler] schema=${SCHEMA_PATH}" >&2
echo "[planetiler] output=${OUTPUT_PATH}" >&2

"${PLANETILER_JAVA_BIN}" "-Xmx${PLANETILER_JAVA_HEAP}" \
  -jar "${PLANETILER_JAR_PATH}" \
  generate-custom \
  --schema="${SCHEMA_PATH}" \
  --output="${OUTPUT_PATH}" \
  --force \
  "$@"
