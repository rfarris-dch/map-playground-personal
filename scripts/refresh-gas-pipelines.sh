#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

RUN_ID="${1:-${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}}"
DATASET="gas-pipelines-v1"
LAYER_NAME="gas_pipelines"
MIN_Z="${GAS_PIPELINES_MIN_ZOOM:-0}"
MAX_Z="${GAS_PIPELINES_MAX_ZOOM:-14}"
PLANETILER_THREADS="${GAS_PIPELINES_TILE_THREADS:-4}"
OUT_DIR="${GAS_PIPELINES_OUT_DIR:-${ROOT_DIR}/.cache/tiles/${DATASET}}"
GEOJSONL_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.geojsonl"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
PLANETILER_SCHEMA_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.planetiler.yml"

ARCGIS_CLIENT_ID="${ARCGIS_CLIENT_ID:-pdt9LXe4ON6ZGumL}"
ARCGIS_CLIENT_SECRET="${ARCGIS_CLIENT_SECRET:-aa71e41c95dd4ef2b09d806196b42b4a}"
GEM_FEATURE_SERVER="https://services6.arcgis.com/3TUSUBFnXJRCRTby/arcgis/rest/services/GEM_GGIT_Gas_Pipelines_2024_12/FeatureServer/0"
PAGE_SIZE=1000

mkdir -p "${OUT_DIR}"

for bin in curl python3 jq bash; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[gas-pipelines] ERROR: missing dependency: ${bin}" >&2
    exit 1
  fi
done

# ─── Step 1: Get ArcGIS token ───
echo "[gas-pipelines] obtaining ArcGIS token..." >&2
TOKEN=$(curl -sf "https://www.arcgis.com/sharing/rest/oauth2/token" \
  -d "client_id=${ARCGIS_CLIENT_ID}" \
  -d "client_secret=${ARCGIS_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  -d "f=json" | jq -r '.access_token')

if [[ -z "${TOKEN}" || "${TOKEN}" == "null" ]]; then
  echo "[gas-pipelines] ERROR: failed to obtain ArcGIS token" >&2
  exit 1
fi
echo "[gas-pipelines] token obtained" >&2

# ─── Step 2: Download from GEM GGIT FeatureServer (US pipelines only) ───
echo "[gas-pipelines] downloading from GEM GGIT FeatureServer..." >&2

TOTAL=$(curl -sf "${GEM_FEATURE_SERVER}/query?where=Countries+LIKE+'%25United+States%25'&returnCountOnly=true&f=json&token=${TOKEN}" | jq -r '.count')
echo "[gas-pipelines] total US features: ${TOTAL}" >&2

OFFSET=0
BATCH_FILES=()
while [[ "${OFFSET}" -lt "${TOTAL}" ]]; do
  BATCH_FILE="${OUT_DIR}/batch-${OFFSET}.geojson"
  echo "[gas-pipelines]   offset=${OFFSET}/${TOTAL}" >&2
  curl -sf "${GEM_FEATURE_SERVER}/query?where=Countries+LIKE+'%25United+States%25'&outFields=PipelineName,Status,Capacity,capacity_range,Owner,Parent,StartYear1&outSR=4326&f=geojson&resultRecordCount=${PAGE_SIZE}&resultOffset=${OFFSET}&token=${TOKEN}" \
    -o "${BATCH_FILE}"
  BATCH_FILES+=("${BATCH_FILE}")
  OFFSET=$((OFFSET + PAGE_SIZE))
done

# ─── Step 3: Merge batches + convert to GeoJSONL ───
echo "[gas-pipelines] merging ${#BATCH_FILES[@]} batches into GeoJSONL..." >&2

python3 - "${GEOJSONL_PATH}" "${BATCH_FILES[@]}" <<'PYEOF'
import json, sys

out_path = sys.argv[1]
batch_paths = sys.argv[2:]
count = 0

with open(out_path, "w") as out:
    for path in batch_paths:
        with open(path) as fh:
            data = json.load(fh)
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                status = (props.get("Status") or "").strip().lower()
                capacity_str = props.get("Capacity") or ""
                capacity_range = (props.get("capacity_range") or "").strip()
                try:
                    capacity = float(capacity_str) if capacity_str else 0
                except (ValueError, TypeError):
                    capacity = 0

                clean_props = {
                    "name": props.get("PipelineName") or "",
                    "operator": props.get("Owner") or "",
                    "parent": props.get("Parent") or "",
                    "status": status,
                    "capacity": capacity,
                    "capacity_range": capacity_range,
                    "start_year": props.get("StartYear1") or 0,
                }
                feature["properties"] = clean_props
                out.write(json.dumps(feature, separators=(",", ":")) + "\n")
                count += 1

print(f"[gas-pipelines] wrote {count} features to GeoJSONL", file=sys.stderr)
PYEOF

rm -f "${OUT_DIR}"/batch-*.geojson

# ─── Step 4: Build Planetiler schema ───
cat > "${PLANETILER_SCHEMA_PATH}" <<YAMLEOF
schema_name: Gas Pipelines
schema_description: Natural gas pipelines from GEM Global Gas Infrastructure Tracker.

sources:
  gas:
    type: geojson
    local_path: '\${ args.input_path }'

layers:
  - id: ${LAYER_NAME}
    features:
      - source: gas
        geometry: line
        attributes:
          - key: name
            tag_value: name
          - key: operator
            tag_value: operator
          - key: parent
            tag_value: parent
          - key: status
            tag_value: status
          - key: capacity
            tag_value: capacity
          - key: capacity_range
            tag_value: capacity_range
          - key: start_year
            tag_value: start_year
YAMLEOF

# ─── Step 5: Build PMTiles ───
echo "[gas-pipelines] building PMTiles with Planetiler z=${MIN_Z}-${MAX_Z}..." >&2

bash "${ROOT_DIR}/scripts/run-planetiler-custom.sh" \
  "${PLANETILER_SCHEMA_PATH}" \
  "${PMTILES_PATH}" \
  "--input_path=${GEOJSONL_PATH}" \
  "--minzoom=${MIN_Z}" \
  "--maxzoom=${MAX_Z}" \
  "--threads=${PLANETILER_THREADS}"

echo "[gas-pipelines] PMTiles ready: ${PMTILES_PATH}" >&2
echo "PMTILES_PATH=${PMTILES_PATH}"
