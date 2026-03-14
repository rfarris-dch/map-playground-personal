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
GEOJSON_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.geojson"
GEOJSONL_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.geojsonl"
PMTILES_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.pmtiles"
PLANETILER_SCHEMA_PATH="${OUT_DIR}/${DATASET}_${RUN_ID}.planetiler.yml"

EIA_FEATURE_SERVER="https://geo.dot.gov/server/rest/services/Hosted/Natural_Gas_Pipelines_US_EIA/FeatureServer/0"
PAGE_SIZE=2000

mkdir -p "${OUT_DIR}"

for bin in curl python3 jq bash; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "[gas-pipelines] ERROR: missing dependency: ${bin}" >&2
    exit 1
  fi
done

# ─── Step 1: Download from EIA FeatureServer ───
echo "[gas-pipelines] downloading from EIA FeatureServer..." >&2

# Get total count
TOTAL=$(curl -sf "${EIA_FEATURE_SERVER}/query?where=1%3D1&returnCountOnly=true&f=json" | jq -r '.count')
echo "[gas-pipelines] total features: ${TOTAL}" >&2

# Download in pages
OFFSET=0
BATCH_FILES=()
while [[ "${OFFSET}" -lt "${TOTAL}" ]]; do
  BATCH_FILE="${OUT_DIR}/batch-${OFFSET}.geojson"
  echo "[gas-pipelines]   offset=${OFFSET}/${TOTAL}" >&2
  curl -sf "${EIA_FEATURE_SERVER}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=${PAGE_SIZE}&resultOffset=${OFFSET}" \
    -o "${BATCH_FILE}"
  BATCH_FILES+=("${BATCH_FILE}")
  OFFSET=$((OFFSET + PAGE_SIZE))
done

# ─── Step 2: Merge batches + convert to GeoJSONL ───
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
                # Normalize properties for tile filtering
                clean_props = {
                    "operator": props.get("operator") or "",
                    "status": props.get("status") or "",
                    "typepipe": props.get("typepipe") or "",
                    "length_m": round(props.get("SHAPE__Length") or 0, 1),
                }
                feature["properties"] = clean_props
                out.write(json.dumps(feature, separators=(",", ":")) + "\n")
                count += 1

print(f"[gas-pipelines] wrote {count} features to GeoJSONL", file=sys.stderr)
PYEOF

# Clean up batch files
rm -f "${OUT_DIR}"/batch-*.geojson

# ─── Step 3: Build Planetiler schema ───
cat > "${PLANETILER_SCHEMA_PATH}" <<YAMLEOF
schema_name: Gas Pipelines
schema_description: Natural gas pipelines from EIA via DOT FeatureServer.

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
          - key: operator
            tag_value: operator
          - key: status
            tag_value: status
          - key: typepipe
            tag_value: typepipe
          - key: length_m
            tag_value: length_m
YAMLEOF

# ─── Step 4: Build PMTiles ───
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
