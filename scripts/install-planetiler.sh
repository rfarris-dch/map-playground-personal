#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLANETILER_VERSION="${PLANETILER_VERSION:-0.10.1}"
PLANETILER_DIR="${ROOT_DIR}/tools/planetiler"
PLANETILER_JAR_PATH="${PLANETILER_JAR:-${PLANETILER_DIR}/planetiler-v${PLANETILER_VERSION}.jar}"
PLANETILER_URL="https://github.com/onthegomap/planetiler/releases/download/v${PLANETILER_VERSION}/planetiler.jar"

if ! command -v curl >/dev/null 2>&1; then
  echo "[planetiler] ERROR: missing dependency in PATH: curl" >&2
  exit 1
fi

mkdir -p "${PLANETILER_DIR}"

if [[ -f "${PLANETILER_JAR_PATH}" ]]; then
  echo "[planetiler] already installed at ${PLANETILER_JAR_PATH}" >&2
  exit 0
fi

echo "[planetiler] downloading ${PLANETILER_URL}" >&2
curl -L --fail --output "${PLANETILER_JAR_PATH}" "${PLANETILER_URL}"
echo "[planetiler] installed ${PLANETILER_JAR_PATH}" >&2
