#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${1:-}"
SOURCE_ROOT="${ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-flood/${RUN_ID}}"
RUN_SUMMARY_PATH="${ROOT_DIR}/var/environmental-sync/environmental-flood/${RUN_ID}/run-summary.json"

resolve_latest_run_id() {
  python3 - "${ROOT_DIR}/var/environmental-sync/environmental-flood/latest.json" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception:
    raise SystemExit(0)

run_id = payload.get("runId")
if not isinstance(run_id, str) or not run_id.strip():
    current = payload.get("current")
    if isinstance(current, dict):
        candidate = current.get("ingestionRunId")
        if isinstance(candidate, str) and candidate.strip():
            run_id = candidate
if isinstance(run_id, str) and run_id.strip():
    print(run_id.strip())
PY
}

for bin in bash python3 ogr2ogr ogrinfo; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[tiles] ERROR: missing dependency in PATH: ${bin}" >&2
    exit 1
  fi
done

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="$(resolve_latest_run_id)"
  SOURCE_ROOT="${ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT:-${ROOT_DIR}/.cache/tilesources/environmental-flood/${RUN_ID}}"
  RUN_SUMMARY_PATH="${ROOT_DIR}/var/environmental-sync/environmental-flood/${RUN_ID}/run-summary.json"
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[tiles] ERROR: unable to resolve flood run id" >&2
  exit 1
fi

python3 - "${RUN_SUMMARY_PATH}" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception as error:
    raise SystemExit(f"[tiles] ERROR: unable to read run summary: {error}")

tile_input_parity = payload.get("tileInputParity")
if not isinstance(tile_input_parity, dict):
    raise SystemExit("[tiles] ERROR: missing tileInputParity in run summary; refresh flood tilesources first")

status = tile_input_parity.get("status")
if status != "passed":
    raise SystemExit(f"[tiles] ERROR: flood tile-input parity status is not passed (got {status!r})")

overlay_kinds = tile_input_parity.get("overlayKinds")
if not isinstance(overlay_kinds, list) or sorted(str(item) for item in overlay_kinds) != ["100", "500"]:
    raise SystemExit("[tiles] ERROR: flood tile-input parity must validate both 100 and 500 overlays before PMTiles build")

overlay_artifacts = tile_input_parity.get("overlayArtifacts")
if not isinstance(overlay_artifacts, list) or len(overlay_artifacts) < 2:
    raise SystemExit("[tiles] ERROR: flood tile-input parity did not record validated overlay artifacts")
PY

DATASET="${ENVIRONMENTAL_FLOOD_TILE_DATASET:-environmental-flood}"
OUT_DIR="${ENVIRONMENTAL_FLOOD_TILES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
MIN_Z="0"
MAX_Z="${ENVIRONMENTAL_FLOOD_MAX_ZOOM:-9}"
SMOKE_MAX_Z="${ENVIRONMENTAL_FLOOD_SMOKE_MAX_ZOOM:-4}"
PLANETILER_THREADS="${ENVIRONMENTAL_FLOOD_TILE_THREADS:-7}"
TMP_ROOT_DIR="${ENVIRONMENTAL_FLOOD_TMP_DIR:-${OUT_DIR}/tmp-${RUN_ID}}"
PLANETILER_SCHEMA_PATH="${ROOT_DIR}/config/planetiler/environmental-flood.yml"

if [[ -n "${ENVIRONMENTAL_FLOOD_MIN_ZOOM:-}" && "${ENVIRONMENTAL_FLOOD_MIN_ZOOM}" != "0" ]]; then
  echo "[tiles] ERROR: environmental flood tiles must keep min zoom fixed at 0 (got ${ENVIRONMENTAL_FLOOD_MIN_ZOOM})" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}" "${TMP_ROOT_DIR}"
TMP_DIR="$(mktemp -d "${TMP_ROOT_DIR}/attempt.XXXXXX")"
REDUCED_SOURCE_FILE="${TMP_DIR}/flood-overlay.gpkg"
OVERLAY_100_SOURCE="${SOURCE_ROOT}/flood-overlay-100.gpkg"
OVERLAY_500_SOURCE="${SOURCE_ROOT}/flood-overlay-500.gpkg"
SMOKE_PMTILES_PATH="${TMP_DIR}/${DATASET}_${RUN_ID}.smoke.pmtiles"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

python3 - "${RUN_SUMMARY_PATH}" "${OVERLAY_100_SOURCE}" "${OVERLAY_500_SOURCE}" <<'PY'
import hashlib
import json
import os
import sqlite3
import sys

summary_path, overlay_100_path, overlay_500_path = sys.argv[1:4]
with open(summary_path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

tile_input_parity = payload["tileInputParity"]
artifacts = tile_input_parity["overlayArtifacts"]
artifacts_by_kind = {}
for artifact in artifacts:
    if not isinstance(artifact, dict):
        raise SystemExit("[tiles] ERROR: invalid overlay artifact entry in run summary")
    overlay_kind = artifact.get("overlayKind")
    if not isinstance(overlay_kind, str):
        raise SystemExit("[tiles] ERROR: missing overlayKind in run summary artifact")
    artifacts_by_kind[overlay_kind] = artifact

def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def validate_overlay(path: str, overlay_kind: str) -> int:
    if not os.path.isfile(path):
        raise SystemExit(f"[tiles] ERROR: source file not found: {path}")

    expected = artifacts_by_kind.get(overlay_kind)
    if not isinstance(expected, dict):
        raise SystemExit(f"[tiles] ERROR: no validated artifact recorded for overlay {overlay_kind}")

    expected_path = expected.get("path")
    if not isinstance(expected_path, str) or os.path.realpath(expected_path) != os.path.realpath(path):
        raise SystemExit(
            f"[tiles] ERROR: overlay {overlay_kind} path does not match parity-validated artifact"
        )

    stat_result = os.stat(path)
    expected_size = expected.get("sizeBytes")
    if not isinstance(expected_size, int) or expected_size != stat_result.st_size:
        raise SystemExit(
            f"[tiles] ERROR: overlay {overlay_kind} size mismatch against parity-validated artifact"
        )

    expected_sha = expected.get("sha256")
    actual_sha = sha256(path)
    if not isinstance(expected_sha, str) or expected_sha != actual_sha:
        raise SystemExit(
            f"[tiles] ERROR: overlay {overlay_kind} sha256 mismatch against parity-validated artifact"
        )

    connection = sqlite3.connect(path)
    try:
        layer_row = connection.execute(
            "SELECT table_name FROM gpkg_contents WHERE table_name = 'flood_overlay'"
        ).fetchone()
        if layer_row is None:
            raise SystemExit(f"[tiles] ERROR: overlay {overlay_kind} missing flood_overlay layer")

        srid_row = connection.execute(
            "SELECT srs_id FROM gpkg_geometry_columns WHERE table_name = 'flood_overlay'"
        ).fetchone()
        if srid_row is None or srid_row[0] != 3857:
            raise SystemExit(f"[tiles] ERROR: overlay {overlay_kind} is not tagged EPSG:3857")

        feature_count = connection.execute("SELECT COUNT(*) FROM flood_overlay").fetchone()[0]
        if not isinstance(feature_count, int) or feature_count <= 0:
            raise SystemExit(f"[tiles] ERROR: overlay {overlay_kind} has no features")

        null_geom_count = connection.execute(
            "SELECT COUNT(*) FROM flood_overlay WHERE geom IS NULL"
        ).fetchone()[0]
        if null_geom_count != 0:
            raise SystemExit(f"[tiles] ERROR: overlay {overlay_kind} has null geometries")

        return feature_count
    finally:
        connection.close()

validate_overlay(overlay_100_path, "100")
validate_overlay(overlay_500_path, "500")
PY

ogrinfo -json -so "${OVERLAY_100_SOURCE}" flood_overlay >/dev/null
ogrinfo -json -so "${OVERLAY_500_SOURCE}" flood_overlay >/dev/null

echo "[tiles] building environmental flood PMTiles with Planetiler" >&2
echo "[tiles] dataset=${DATASET} runId=${RUN_ID} z=${MIN_Z}-${MAX_Z} threads=${PLANETILER_THREADS}" >&2
echo "[tiles] build-mode=planetiler handoff=canonical-geoparquet source_root=${SOURCE_ROOT}" >&2

ogr2ogr -f GPKG \
  "${REDUCED_SOURCE_FILE}" \
  "${OVERLAY_100_SOURCE}" \
  flood_overlay \
  -nln flood_overlay \
  >/dev/null

ogr2ogr -f GPKG \
  -update \
  -append \
  "${REDUCED_SOURCE_FILE}" \
  "${OVERLAY_500_SOURCE}" \
  flood_overlay \
  -nln flood_overlay \
  >/dev/null

echo "[tiles] reduced overlay geopackage ready: ${REDUCED_SOURCE_FILE}" >&2

ogrinfo -json -so "${REDUCED_SOURCE_FILE}" flood_overlay >/dev/null

python3 - "${OVERLAY_100_SOURCE}" "${OVERLAY_500_SOURCE}" "${REDUCED_SOURCE_FILE}" <<'PY'
import sqlite3
import sys

overlay_100_path, overlay_500_path, merged_path = sys.argv[1:4]

def count_rows(path: str, sql: str) -> int:
    connection = sqlite3.connect(path)
    try:
        row = connection.execute(sql).fetchone()
        return 0 if row is None else int(row[0])
    finally:
        connection.close()

def read_srid(path: str) -> int:
    connection = sqlite3.connect(path)
    try:
        row = connection.execute(
            "SELECT srs_id FROM gpkg_geometry_columns WHERE table_name = 'flood_overlay'"
        ).fetchone()
        if row is None:
            raise SystemExit(f"[tiles] ERROR: {path} missing gpkg_geometry_columns entry")
        return int(row[0])
    finally:
        connection.close()

source_100_count = count_rows(overlay_100_path, "SELECT COUNT(*) FROM flood_overlay")
source_500_count = count_rows(overlay_500_path, "SELECT COUNT(*) FROM flood_overlay")
merged_100_count = count_rows(merged_path, "SELECT COUNT(*) FROM flood_overlay WHERE flood_band = '100'")
merged_500_count = count_rows(merged_path, "SELECT COUNT(*) FROM flood_overlay WHERE flood_band = '500'")
merged_other_count = count_rows(
    merged_path,
    "SELECT COUNT(*) FROM flood_overlay WHERE flood_band NOT IN ('100', '500')"
)
merged_null_geom_count = count_rows(merged_path, "SELECT COUNT(*) FROM flood_overlay WHERE geom IS NULL")

if read_srid(merged_path) != 3857:
    raise SystemExit("[tiles] ERROR: merged flood overlay GeoPackage is not tagged EPSG:3857")
if merged_100_count != source_100_count:
    raise SystemExit("[tiles] ERROR: merged flood overlay count mismatch for band 100")
if merged_500_count != source_500_count:
    raise SystemExit("[tiles] ERROR: merged flood overlay count mismatch for band 500")
if merged_other_count != 0:
    raise SystemExit("[tiles] ERROR: merged flood overlay contains unexpected flood_band values")
if merged_null_geom_count != 0:
    raise SystemExit("[tiles] ERROR: merged flood overlay contains null geometries")
PY

echo "[tiles] smoke-building environmental flood PMTiles" >&2
bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_PATH}" \
  "${SMOKE_PMTILES_PATH}" \
  "--input_path=${REDUCED_SOURCE_FILE}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${SMOKE_MAX_Z}" \
  "--threads=${PLANETILER_THREADS}"

bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_PATH}" \
  "${PMTILES_PATH}" \
  "--input_path=${REDUCED_SOURCE_FILE}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${MAX_Z}" \
  "--threads=${PLANETILER_THREADS}"

echo "[tiles] PMTiles ready" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
