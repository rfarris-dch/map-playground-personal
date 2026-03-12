#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/apps/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/apps/api/.env"
  set +a
fi

DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "[parcels] ERROR: missing DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[parcels] ERROR: psql not found in PATH" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[parcels] ERROR: jq not found in PATH" >&2
  exit 1
fi

INPUT="${1:-}"
if [[ -z "${INPUT}" ]]; then
  echo "usage: scripts/load-parcels-canonical.sh <ndjson-file-or-dir> [ingestion_run_id]" >&2
  exit 2
fi

RUN_ID="${2:-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_REASON="${RUN_REASON:-manual}"
BACKUP_SUFFIX="$(date -u +%Y%m%d%H%M%S)"
DATA_VERSION="$(date -u +%Y-%m-%d)"
if [[ "${RUN_ID}" =~ ^([0-9]{4})([0-9]{2})([0-9]{2}) ]]; then
  DATA_VERSION="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-${BASH_REMATCH[3]}"
fi

RUN_ID_SANITIZED="$(printf '%s' "${RUN_ID}" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '_')"
RUN_ID_SANITIZED="${RUN_ID_SANITIZED#_}"
if [[ -z "${RUN_ID_SANITIZED}" ]]; then
  RUN_ID_SANITIZED="$(date -u +%Y%m%dt%H%M%S)"
fi
RUN_ID_SUFFIX="${RUN_ID_SANITIZED:0:45}"
STAGE_TABLE_NAME="parcels_stage_raw_${RUN_ID_SUFFIX}"
STAGE_TABLE_FQN="parcel_build.${STAGE_TABLE_NAME}"
REUSE_STAGE="${PARCELS_DB_LOAD_REUSE_STAGE:-1}"
readonly PARCEL_HISTORY_RETAIN_COUNT=3

RUN_SUMMARY_PATH=""
if [[ -d "${INPUT}" ]]; then
  RUN_SUMMARY_PATH="${INPUT}/run-summary.json"
fi
STAGE_MARKER_PATH=""
if [[ -d "${INPUT}" ]]; then
  STAGE_MARKER_PATH="${INPUT}/db-stage-complete.json"
fi

SOURCE_SERVICE="unknown"
RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_STATUS="loaded"
RUN_NOTES='{}'
ACTIVE_STATUS_PATH="${ACTIVE_STATUS_PATH:-}"
RUN_SUMMARY_WRITTEN_TOTAL="0"
LOAD_STATUS_MARKED_FAILED=0
MATERIALIZE_ACTIVE_PIDS=()
MATERIALIZE_ACTIVE_STATES=()
MATERIALIZE_ACTIVE_EXPECTED=()

update_active_status() {
  local summary="$1"
  if [[ -z "${ACTIVE_STATUS_PATH}" ]]; then
    return
  fi

  python3 - "${ACTIVE_STATUS_PATH}" "${RUN_ID}" "${RUN_REASON}" "${summary}" <<'PY'
import json
import re
import sys
from datetime import datetime, timezone

path, run_id, run_reason, summary = sys.argv[1:5]

def parse_db_load_progress(summary_text: str):
    normalized = summary_text.strip()
    if not normalized.startswith("db-load:"):
        return None

    detail_text = normalized[len("db-load:") :].strip()
    if len(detail_text) == 0:
        return None

    parts = detail_text.split(None, 1)
    step_key = parts[0].strip().lower()
    detail = parts[1].strip() if len(parts) > 1 else ""

    db_load = {
        "stepKey": step_key,
        "activeWorkers": [],
    }

    ratio_match = re.search(r"([0-9]+)\/([0-9]+)", detail)
    if step_key == "staging":
        if ratio_match is not None:
            loaded = int(ratio_match.group(1))
            total = int(ratio_match.group(2))
            db_load["loadedFiles"] = loaded
            if total > 0:
                db_load["totalFiles"] = total
                db_load["percent"] = round((loaded / total) * 100, 2)
            remaining_detail = detail[ratio_match.end() :].strip()
            if len(remaining_detail) > 0:
                db_load["currentFile"] = remaining_detail
        elif len(detail) > 0:
            db_load["currentFile"] = detail
    elif step_key == "materialize":
        if ratio_match is not None:
            completed = int(ratio_match.group(1))
            total = int(ratio_match.group(2))
            if total > 0:
                db_load["percent"] = round((completed / total) * 100, 2)

        states_match = re.search(r"\bstates=([0-9]+)\/([0-9]+)\b", detail)
        if states_match is not None:
            db_load["completedStates"] = int(states_match.group(1))
            db_load["totalStates"] = int(states_match.group(2))

        active_match = re.search(r"\bactive=([^ ]+)", detail)
        if active_match is not None:
            active_token = active_match.group(1).strip()
            if len(active_token) > 0 and active_token.lower() != "none":
                db_load["activeWorkers"] = [
                    token.strip()
                    for token in active_token.split(",")
                    if len(token.strip()) > 0
                ]

        if len(detail) > 0:
            db_load["currentFile"] = detail
    elif step_key == "index-stage-state2":
        if ratio_match is not None:
            completed = int(ratio_match.group(1))
            total = int(ratio_match.group(2))
            if total > 0:
                db_load["percent"] = round((completed / total) * 100, 2)
        if len(detail) > 0:
            db_load["currentFile"] = detail
    else:
        if len(detail) > 0:
            db_load["currentFile"] = detail
        if step_key == "complete":
            db_load["percent"] = 100.0

    return {
        "schemaVersion": 1,
        "phase": "loading",
        "dbLoad": db_load,
    }

payload = {
    "runId": run_id,
    "reason": run_reason,
    "phase": "loading",
    "isRunning": True,
    "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "summary": summary,
}
progress = parse_db_load_progress(summary)
if progress is not None:
    payload["progress"] = progress
try:
    with open(path, "r", encoding="utf-8") as handle:
        existing = json.load(handle)
except Exception:
    pass

with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY
}

mark_load_failed() {
  local exit_code="$1"
  if [[ "${LOAD_STATUS_MARKED_FAILED}" -eq 1 ]]; then
    return
  fi

  LOAD_STATUS_MARKED_FAILED=1
  update_active_status "db-load:failed exit=${exit_code}"
}

handle_load_error() {
  local exit_code="$?"
  terminate_materialize_workers
  mark_load_failed "${exit_code}"
  exit "${exit_code}"
}

trap handle_load_error ERR

terminate_materialize_workers() {
  local active_pid

  if [[ "${#MATERIALIZE_ACTIVE_PIDS[@]}" -eq 0 ]]; then
    return
  fi

  for active_pid in "${MATERIALIZE_ACTIVE_PIDS[@]}"; do
    if kill -0 "${active_pid}" >/dev/null 2>&1; then
      kill "${active_pid}" >/dev/null 2>&1 || true
    fi
  done

  for active_pid in "${MATERIALIZE_ACTIVE_PIDS[@]}"; do
    wait "${active_pid}" 2>/dev/null || true
  done

  MATERIALIZE_ACTIVE_PIDS=()
  MATERIALIZE_ACTIVE_STATES=()
  MATERIALIZE_ACTIVE_EXPECTED=()
}

format_elapsed_label() {
  local total_seconds="$1"
  if [[ -z "${total_seconds}" || "${total_seconds}" -lt 1 ]]; then
    echo "<1s"
    return
  fi

  local hours=$((total_seconds / 3600))
  local minutes=$(((total_seconds % 3600) / 60))
  local seconds=$((total_seconds % 60))

  if [[ "${hours}" -gt 0 ]]; then
    echo "${hours}h ${minutes}m ${seconds}s"
    return
  fi

  if [[ "${minutes}" -gt 0 ]]; then
    echo "${minutes}m ${seconds}s"
    return
  fi

  echo "${seconds}s"
}

format_compact_duration_label() {
  local total_seconds="$1"
  if [[ -z "${total_seconds}" || "${total_seconds}" -lt 1 ]]; then
    echo "0s"
    return
  fi

  local hours=$((total_seconds / 3600))
  local minutes=$(((total_seconds % 3600) / 60))
  local seconds=$((total_seconds % 60))
  local label=""

  if [[ "${hours}" -gt 0 ]]; then
    label="${label}${hours}h"
  fi
  if [[ "${minutes}" -gt 0 ]]; then
    label="${label}${minutes}m"
  fi
  if [[ "${seconds}" -gt 0 || -z "${label}" ]]; then
    label="${label}${seconds}s"
  fi

  echo "${label}"
}

format_bytes_label() {
  local bytes="$1"
  if [[ -z "${bytes}" || ! "${bytes}" =~ ^[0-9]+$ ]]; then
    echo "0B"
    return
  fi

  local kib=1024
  local mib=$((kib * 1024))
  local gib=$((mib * 1024))
  local tib=$((gib * 1024))

  if (( bytes >= tib )); then
    awk -v n="${bytes}" -v d="${tib}" 'BEGIN { printf "%.1fTiB", n / d }'
    return
  fi
  if (( bytes >= gib )); then
    awk -v n="${bytes}" -v d="${gib}" 'BEGIN { printf "%.1fGiB", n / d }'
    return
  fi
  if (( bytes >= mib )); then
    awk -v n="${bytes}" -v d="${mib}" 'BEGIN { printf "%.1fMiB", n / d }'
    return
  fi
  if (( bytes >= kib )); then
    awk -v n="${bytes}" -v d="${kib}" 'BEGIN { printf "%.1fKiB", n / d }'
    return
  fi

  echo "${bytes}B"
}

if [[ -n "${RUN_SUMMARY_PATH}" && -f "${RUN_SUMMARY_PATH}" ]]; then
  SOURCE_SERVICE="$(jq -r '.featureLayerUrl // "unknown"' "${RUN_SUMMARY_PATH}" 2>/dev/null || echo "unknown")"
  RUN_STARTED_AT="$(jq -r '.startedAt // empty' "${RUN_SUMMARY_PATH}" 2>/dev/null || true)"
  RUN_COMPLETED_AT="$(jq -r '.completedAt // empty' "${RUN_SUMMARY_PATH}" 2>/dev/null || true)"
  RUN_SUMMARY_WRITTEN_TOTAL="$(jq -r '[(.states // [])[] | (.writtenCount // 0)] | add // 0' "${RUN_SUMMARY_PATH}" 2>/dev/null || echo "0")"
  RUN_NOTES="$(
    jq -c \
      '{
        pageSize: .pageSize,
        tokenExpiresInSeconds: .tokenExpiresInSeconds,
        states: [(.states // [])[] | {
          state,
          expectedCount,
          pagesFetched,
          writtenCount,
          lastSourceId,
          lastTieBreakerId
        }]
      }' \
      "${RUN_SUMMARY_PATH}" 2>/dev/null || echo '{}'
  )"
  RUN_STATUS="completed"
fi

if [[ -z "${SOURCE_SERVICE}" ]]; then
  SOURCE_SERVICE="unknown"
fi

if [[ -z "${RUN_STARTED_AT}" ]]; then
  RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

if [[ -z "${RUN_COMPLETED_AT}" ]]; then
  RUN_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

ISO_DATE_TIME_PATTERN='^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
if [[ ! "${RUN_STARTED_AT}" =~ ${ISO_DATE_TIME_PATTERN} ]]; then
  RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi
if [[ ! "${RUN_COMPLETED_AT}" =~ ${ISO_DATE_TIME_PATTERN} ]]; then
  RUN_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

echo "[parcels] load-and-swap starting runId=${RUN_ID}"
update_active_status "db-load:prepare-schema"

if [[ -f "${ROOT_DIR}/scripts/sql/parcels-canonical-schema.sql" ]]; then
  echo "[parcels] ensuring base schema from scripts/sql/parcels-canonical-schema.sql"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/scripts/sql/parcels-canonical-schema.sql"
fi

echo "[parcels] preparing build tables"
update_active_status "db-load:prepare-build-tables"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
CREATE SCHEMA IF NOT EXISTS parcel_build;
CREATE SCHEMA IF NOT EXISTS parcel_history;
CREATE SCHEMA IF NOT EXISTS parcel_current;

CREATE UNLOGGED TABLE IF NOT EXISTS ${STAGE_TABLE_FQN} (
  raw_json jsonb NOT NULL
);

DROP TABLE IF EXISTS parcel_build.parcels;
CREATE TABLE parcel_build.parcels (
  parcel_id text NOT NULL,
  source_oid bigint NULL,
  state2 text NULL,
  geoid text NULL,
  source_updated_at timestamptz NULL,
  ingestion_run_id text NOT NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_3857 geometry(MultiPolygon, 3857) NOT NULL
);
SQL

STAGED_ROW_COUNT="$(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT COUNT(*) FROM ${STAGE_TABLE_FQN}"
)"
SHOULD_STAGE=1

if [[ "${REUSE_STAGE}" == "1" && -n "${STAGE_MARKER_PATH}" && -f "${STAGE_MARKER_PATH}" ]]; then
  MARKER_RUN_ID="$(jq -r '.runId // empty' "${STAGE_MARKER_PATH}" 2>/dev/null || true)"
  MARKER_STAGE_TABLE="$(jq -r '.stageTable // empty' "${STAGE_MARKER_PATH}" 2>/dev/null || true)"
  MARKER_ROW_COUNT="$(jq -r '.rowCount // empty' "${STAGE_MARKER_PATH}" 2>/dev/null || true)"
  if [[ "${MARKER_RUN_ID}" == "${RUN_ID}" &&
        "${MARKER_STAGE_TABLE}" == "${STAGE_TABLE_NAME}" &&
        "${MARKER_ROW_COUNT}" =~ ^[0-9]+$ &&
        "${MARKER_ROW_COUNT}" -gt 0 &&
        "${STAGED_ROW_COUNT}" == "${MARKER_ROW_COUNT}" ]]; then
    SHOULD_STAGE=0
    STAGED_ROW_COUNT="${MARKER_ROW_COUNT}"
    update_active_status "db-load:reusing-staged ${STAGED_ROW_COUNT} rows"
    echo "[parcels] reusing staged rows from ${STAGE_TABLE_FQN} count=${STAGED_ROW_COUNT}"
  fi
fi

if [[ "${SHOULD_STAGE}" == "1" ]]; then
  update_active_status "db-load:truncate-stage-table"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE ${STAGE_TABLE_FQN}"

  FILES=()
  if [[ -d "${INPUT}" ]]; then
    FILES+=("${INPUT}"/*.ndjson "${INPUT}"/*.jsonl "${INPUT}"/*.ndjson.gz "${INPUT}"/*.jsonl.gz)
  else
    for file in ${INPUT}; do
      FILES+=("$file")
    done
  fi

  if [[ "${#FILES[@]}" -eq 0 ]]; then
    echo "[parcels] ERROR: no input files found for: ${INPUT}" >&2
    exit 3
  fi

  echo "[parcels] staging ${#FILES[@]} file(s) into ${STAGE_TABLE_FQN}"
  TOTAL_FILES="${#FILES[@]}"
  LOADED_FILES=0
  for file in "${FILES[@]}"; do
    NEXT_FILE_INDEX=$((LOADED_FILES + 1))
    FILE_BASENAME="$(basename "${file}")"
    update_active_status "db-load:staging ${NEXT_FILE_INDEX}/${TOTAL_FILES} ${FILE_BASENAME}"
    echo "  - ${file}"
    if [[ "${file}" == *.gz ]]; then
      gunzip -c "${file}" |
        psql "$DB_URL" -v ON_ERROR_STOP=1 -c "\copy ${STAGE_TABLE_FQN}(raw_json) FROM STDIN WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\b', ESCAPE E'\b')"
    else
      cat "${file}" |
        psql "$DB_URL" -v ON_ERROR_STOP=1 -c "\copy ${STAGE_TABLE_FQN}(raw_json) FROM STDIN WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\b', ESCAPE E'\b')"
    fi
    LOADED_FILES=$((LOADED_FILES + 1))
  done

  STAGED_ROW_COUNT="$(
    psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT COUNT(*) FROM ${STAGE_TABLE_FQN}"
  )"

  if [[ -n "${STAGE_MARKER_PATH}" ]]; then
    update_active_status "db-load:record-stage-cache"
    python3 - "${STAGE_MARKER_PATH}" "${RUN_ID}" "${STAGE_TABLE_NAME}" "${STAGED_ROW_COUNT}" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, run_id, stage_table, row_count = sys.argv[1:5]
payload = {
    "runId": run_id,
    "stageTable": stage_table,
    "rowCount": int(row_count),
    "completedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY
  fi
fi

echo "[parcels] materializing parcel_build.parcels from staged ArcGIS features"
MATERIALIZE_APP_NAME="parcels-materialize-${RUN_ID_SUFFIX}"
MATERIALIZE_BASELINE_ROWS_PER_SECOND="${PARCELS_MATERIALIZE_BASELINE_ROWS_PER_SECOND:-4500}"
if [[ ! "${MATERIALIZE_BASELINE_ROWS_PER_SECOND}" =~ ^[0-9]+$ || "${MATERIALIZE_BASELINE_ROWS_PER_SECOND}" -le 0 ]]; then
  MATERIALIZE_BASELINE_ROWS_PER_SECOND=4500
fi
MATERIALIZE_RATE_MIN_ROWS_FOR_AVG="${PARCELS_MATERIALIZE_RATE_MIN_ROWS_FOR_AVG:-250000}"
if [[ ! "${MATERIALIZE_RATE_MIN_ROWS_FOR_AVG}" =~ ^[0-9]+$ || "${MATERIALIZE_RATE_MIN_ROWS_FOR_AVG}" -lt 0 ]]; then
  MATERIALIZE_RATE_MIN_ROWS_FOR_AVG=250000
fi
MATERIALIZE_RATE_MIN_STATES_FOR_AVG="${PARCELS_MATERIALIZE_RATE_MIN_STATES_FOR_AVG:-4}"
if [[ ! "${MATERIALIZE_RATE_MIN_STATES_FOR_AVG}" =~ ^[0-9]+$ || "${MATERIALIZE_RATE_MIN_STATES_FOR_AVG}" -lt 1 ]]; then
  MATERIALIZE_RATE_MIN_STATES_FOR_AVG=4
fi
MATERIALIZE_STATE_CONCURRENCY="${PARCELS_MATERIALIZE_STATE_CONCURRENCY:-4}"
if [[ ! "${MATERIALIZE_STATE_CONCURRENCY}" =~ ^[0-9]+$ || "${MATERIALIZE_STATE_CONCURRENCY}" -lt 1 ]]; then
  MATERIALIZE_STATE_CONCURRENCY=4
fi
if [[ "${MATERIALIZE_STATE_CONCURRENCY}" -gt 16 ]]; then
  MATERIALIZE_STATE_CONCURRENCY=16
fi
MATERIALIZE_PROGRESS_INTERVAL_SECONDS="${PARCELS_MATERIALIZE_PROGRESS_INTERVAL_SECONDS:-5}"
if [[ ! "${MATERIALIZE_PROGRESS_INTERVAL_SECONDS}" =~ ^[0-9]+$ || "${MATERIALIZE_PROGRESS_INTERVAL_SECONDS}" -lt 1 ]]; then
  MATERIALIZE_PROGRESS_INTERVAL_SECONDS=5
fi
MATERIALIZE_STAGE_INDEX_ENABLED="${PARCELS_MATERIALIZE_STAGE_INDEX_ENABLED:-1}"
if [[ "${MATERIALIZE_STAGE_INDEX_ENABLED}" != "0" ]]; then
  MATERIALIZE_STAGE_INDEX_ENABLED="1"
fi

PG_DATA_DIRECTORY="$(psql "$DB_URL" -Atqc "SHOW data_directory" 2>/dev/null || true)"
PG_TMP_DIRECTORY=""
if [[ -n "${PG_DATA_DIRECTORY}" ]]; then
  PG_TMP_DIRECTORY="${PG_DATA_DIRECTORY}/base/pgsql_tmp"
elif [[ -d "/opt/homebrew/var/postgresql@17/base/pgsql_tmp" ]]; then
  PG_TMP_DIRECTORY="/opt/homebrew/var/postgresql@17/base/pgsql_tmp"
fi

PGAPPNAME="${MATERIALIZE_APP_NAME}-setup" psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
CREATE OR REPLACE FUNCTION parcel_build.safe_build_multipolygon_from_rings(rings_json jsonb)
RETURNS geometry
LANGUAGE plpgsql
AS \$\$
DECLARE
  polygon_geom geometry;
BEGIN
  IF rings_json IS NULL OR jsonb_typeof(rings_json) <> 'array' OR jsonb_array_length(rings_json) = 0 THEN
    RETURN NULL;
  END IF;

  BEGIN
    polygon_geom := ST_SetSRID(
      ST_GeomFromGeoJSON(
        jsonb_build_object('type', 'Polygon', 'coordinates', rings_json)::text
      ),
      4326
    );
  EXCEPTION WHEN OTHERS THEN
    polygon_geom := NULL;
  END;

  IF polygon_geom IS NULL OR ST_IsEmpty(polygon_geom) THEN
    BEGIN
      SELECT
        ST_CollectionExtract(
          ST_MakeValid(ST_BuildArea(ST_Collect(closed_ring))),
          3
        )
      INTO polygon_geom
      FROM (
        SELECT
          CASE
            WHEN ST_IsClosed(line_geom) THEN line_geom
            ELSE ST_AddPoint(line_geom, ST_StartPoint(line_geom))
          END AS closed_ring
        FROM (
          SELECT
            ST_SetSRID(
              ST_GeomFromGeoJSON(
                jsonb_build_object('type', 'LineString', 'coordinates', ring.ring_json)::text
              ),
              4326
            ) AS line_geom
          FROM jsonb_array_elements(rings_json) AS ring(ring_json)
        ) AS ring_lines
      ) AS linework;
    EXCEPTION WHEN OTHERS THEN
      polygon_geom := NULL;
    END;
  END IF;

  IF polygon_geom IS NULL OR ST_IsEmpty(polygon_geom) THEN
    RETURN NULL;
  END IF;

  BEGIN
    polygon_geom := ST_CollectionExtract(ST_MakeValid(polygon_geom), 3);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF polygon_geom IS NULL OR ST_IsEmpty(polygon_geom) THEN
    RETURN NULL;
  END IF;

  RETURN ST_Multi(polygon_geom)::geometry(MultiPolygon, 4326);
END
\$\$;
SQL

if [[ "${MATERIALIZE_STAGE_INDEX_ENABLED}" == "1" ]]; then
  INDEX_APP_NAME="${MATERIALIZE_APP_NAME}-setup-index"
  update_active_status "db-load:index-stage-state2 0/100"
  PGAPPNAME="${INDEX_APP_NAME}" psql "$DB_URL" -v ON_ERROR_STOP=1 -c \
    "CREATE INDEX IF NOT EXISTS ${STAGE_TABLE_NAME}_state2_expr_idx ON ${STAGE_TABLE_FQN} ((upper(trim(COALESCE(raw_json -> 'attributes' ->> 'state2', ''))))); " &
  INDEX_CREATE_PID="$!"

  while kill -0 "${INDEX_CREATE_PID}" >/dev/null 2>&1; do
    INDEX_PROGRESS_LINE="$(
      psql "$DB_URL" -Atqc \
        "SELECT COALESCE(blocks_done, 0), COALESCE(NULLIF(blocks_total, 0), 0)
         FROM pg_stat_progress_create_index progress
         INNER JOIN pg_stat_activity activity ON activity.pid = progress.pid
         WHERE activity.application_name = '${INDEX_APP_NAME}'
         LIMIT 1" \
        2>/dev/null || true
    )"

    if [[ -n "${INDEX_PROGRESS_LINE}" ]]; then
      IFS='|' read -r INDEX_BLOCKS_DONE INDEX_BLOCKS_TOTAL <<< "${INDEX_PROGRESS_LINE}"
      if [[ "${INDEX_BLOCKS_DONE}" =~ ^[0-9]+$ && "${INDEX_BLOCKS_TOTAL}" =~ ^[0-9]+$ && "${INDEX_BLOCKS_TOTAL}" -gt 0 ]]; then
        INDEX_PERCENT=$((INDEX_BLOCKS_DONE * 100 / INDEX_BLOCKS_TOTAL))
        if [[ "${INDEX_PERCENT}" -gt 99 ]]; then
          INDEX_PERCENT=99
        fi
        update_active_status "db-load:index-stage-state2 ${INDEX_PERCENT}/100 blocks=${INDEX_BLOCKS_DONE}/${INDEX_BLOCKS_TOTAL}"
      fi
    fi
    sleep 3
  done

  wait "${INDEX_CREATE_PID}"
  update_active_status "db-load:index-stage-state2 99/100 finalizing"
  PGAPPNAME="${INDEX_APP_NAME}" psql "$DB_URL" -v ON_ERROR_STOP=1 -c "ANALYZE ${STAGE_TABLE_FQN};"
  update_active_status "db-load:index-stage-state2 100/100"
fi

MATERIALIZE_STATES=()
MATERIALIZE_EXPECTED=()
if [[ -n "${RUN_SUMMARY_PATH}" && -f "${RUN_SUMMARY_PATH}" ]]; then
  while IFS='|' read -r state_code expected_count; do
    if [[ -z "${state_code}" ]]; then
      continue
    fi

    state_code="$(printf '%s' "${state_code}" | tr '[:lower:]' '[:upper:]')"
    if [[ "${state_code}" =~ ^[A-Z]{2}$ ]]; then
      MATERIALIZE_STATES+=("${state_code}")
      if [[ "${expected_count}" =~ ^[0-9]+$ ]]; then
        MATERIALIZE_EXPECTED+=("${expected_count}")
      else
        MATERIALIZE_EXPECTED+=("0")
      fi
    fi
  done < <(jq -r '.states[]? | [.state, (.expectedCount // 0)] | @tsv' "${RUN_SUMMARY_PATH}" 2>/dev/null | tr '\t' '|')
fi

if [[ "${#MATERIALIZE_STATES[@]}" -eq 0 ]]; then
  while IFS= read -r state_code; do
    if [[ -z "${state_code}" ]]; then
      continue
    fi

    MATERIALIZE_STATES+=("${state_code}")
    MATERIALIZE_EXPECTED+=("0")
  done < <(
    psql "$DB_URL" -Atqc \
      "SELECT DISTINCT upper(trim(COALESCE(raw_json -> 'attributes' ->> 'state2', '')))
       FROM ${STAGE_TABLE_FQN}
       WHERE length(trim(COALESCE(raw_json -> 'attributes' ->> 'state2', ''))) = 2
       ORDER BY 1"
  )
fi

MATERIALIZE_INCLUDE_MISSING_STATE="${PARCELS_MATERIALIZE_INCLUDE_MISSING_STATE:-0}"
if [[ "${MATERIALIZE_INCLUDE_MISSING_STATE}" == "1" ]]; then
  MISSING_STATE_ROWS="$(
    psql "$DB_URL" -Atqc \
      "SELECT COUNT(*)
       FROM ${STAGE_TABLE_FQN}
       WHERE COALESCE(trim(COALESCE(raw_json -> 'attributes' ->> 'state2', '')), '') = ''"
  )"
  if [[ "${MISSING_STATE_ROWS}" =~ ^[0-9]+$ && "${MISSING_STATE_ROWS}" -gt 0 ]]; then
    MATERIALIZE_STATES+=("__MISSING__")
    MATERIALIZE_EXPECTED+=("${MISSING_STATE_ROWS}")
  fi
fi

MATERIALIZE_TOTAL_STATES="${#MATERIALIZE_STATES[@]}"
if [[ "${MATERIALIZE_TOTAL_STATES}" -eq 0 ]]; then
  echo "[parcels] ERROR: no states discovered for materialize" >&2
  exit 3
fi

if [[ "${MATERIALIZE_STATE_CONCURRENCY}" -gt "${MATERIALIZE_TOTAL_STATES}" ]]; then
  MATERIALIZE_STATE_CONCURRENCY="${MATERIALIZE_TOTAL_STATES}"
fi

MATERIALIZE_TOTAL_EXPECTED=0
for expected_count in "${MATERIALIZE_EXPECTED[@]}"; do
  if [[ "${expected_count}" =~ ^[0-9]+$ ]]; then
    MATERIALIZE_TOTAL_EXPECTED=$((MATERIALIZE_TOTAL_EXPECTED + expected_count))
  fi
done
if [[ "${MATERIALIZE_TOTAL_EXPECTED}" -le 0 ]]; then
  MATERIALIZE_TOTAL_EXPECTED="${STAGED_ROW_COUNT}"
fi

if [[ -d "${INPUT}" ]]; then
  MATERIALIZE_STATE_LOG_ROOT="${INPUT}"
else
  MATERIALIZE_STATE_LOG_ROOT="${ROOT_DIR}/var/parcels-sync"
fi

run_materialize_state() {
  local state_code="$1"
  local state_log_path="$2"
  local state_filter_sql=""

  if [[ "${state_code}" == "__MISSING__" ]]; then
    state_filter_sql="COALESCE(trim(COALESCE(raw_json -> 'attributes' ->> 'state2', '')), '') = ''"
  else
    state_filter_sql="upper(trim(COALESCE(raw_json -> 'attributes' ->> 'state2', ''))) = :'state2'"
  fi

  PGAPPNAME="${MATERIALIZE_APP_NAME}-${state_code}" psql "$DB_URL" \
    -v ON_ERROR_STOP=1 \
    -v run_id="$RUN_ID" \
    -v state2="${state_code}" >"${state_log_path}" 2>&1 <<SQL
WITH raw AS (
  SELECT
    COALESCE(raw_json -> 'attributes', '{}'::jsonb) AS attrs_json,
    raw_json -> 'geometry' -> 'rings' AS rings_json
  FROM ${STAGE_TABLE_FQN}
  WHERE ${state_filter_sql}
),
prepared AS (
  SELECT
    COALESCE(
      NULLIF(trim(attrs_json ->> 'll_uuid'), ''),
      NULLIF(trim(attrs_json ->> 'll_stable_id'), ''),
      NULLIF(trim(attrs_json ->> 'id'), '')
    ) AS parcel_id,
    NULLIF(trim(attrs_json ->> 'id'), '') AS source_oid_text,
    CASE
      WHEN length(COALESCE(NULLIF(trim(attrs_json ->> 'state2'), ''), '')) = 2
        THEN upper(trim(attrs_json ->> 'state2'))
      ELSE NULL
    END AS state2,
    NULLIF(trim(attrs_json ->> 'geoid'), '') AS geoid,
    NULLIF(trim(attrs_json ->> 'll_updated_at'), '') AS updated_text,
    attrs_json,
    rings_json
  FROM raw
),
geometries AS (
  SELECT
    parcel_id,
    source_oid_text,
    state2,
    geoid,
    updated_text,
    attrs_json,
    parcel_build.safe_build_multipolygon_from_rings(rings_json) AS polygon_geom
  FROM prepared
  WHERE parcel_id IS NOT NULL
),
normalized AS (
  SELECT
    parcel_id,
    CASE
      WHEN source_oid_text IS NULL THEN NULL
      WHEN source_oid_text ~ '^-?[0-9]+$' THEN source_oid_text::bigint
      ELSE NULL
    END AS source_oid,
    state2,
    geoid,
    CASE
      WHEN updated_text IS NULL THEN NULL
      WHEN updated_text ~ '^[0-9]{13}$' THEN to_timestamp(updated_text::double precision / 1000.0)
      WHEN updated_text ~ '^[0-9]{10}$' THEN to_timestamp(updated_text::double precision)
      WHEN updated_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN updated_text::timestamptz
      ELSE NULL
    END AS source_updated_at,
    attrs_json,
    polygon_geom AS geom
  FROM geometries
  WHERE polygon_geom IS NOT NULL
    AND NOT ST_IsEmpty(polygon_geom)
)
INSERT INTO parcel_build.parcels (
  parcel_id,
  source_oid,
  state2,
  geoid,
  source_updated_at,
  ingestion_run_id,
  attrs,
  geom,
  geom_3857
)
SELECT
  parcel_id,
  source_oid,
  state2,
  geoid,
  source_updated_at,
  :'run_id'::text AS ingestion_run_id,
  attrs_json AS attrs,
  geom,
  ST_Transform(geom, 3857)::geometry(MultiPolygon, 3857) AS geom_3857
FROM normalized;
SQL
}

render_materialize_status() {
  NOW_EPOCH="$(date +%s)"
  ELAPSED_SECONDS="$((NOW_EPOCH - MATERIALIZE_STARTED_AT))"
  ELAPSED_LABEL="$(format_compact_duration_label "${ELAPSED_SECONDS}")"

  PROCESSED_EXPECTED="${MATERIALIZE_COMPLETED_EXPECTED}"
  if [[ "${PROCESSED_EXPECTED}" -lt 0 ]]; then
    PROCESSED_EXPECTED=0
  fi
  if [[ "${PROCESSED_EXPECTED}" -gt "${MATERIALIZE_TOTAL_EXPECTED}" ]]; then
    PROCESSED_EXPECTED="${MATERIALIZE_TOTAL_EXPECTED}"
  fi

  MATERIALIZE_PERCENT=0
  if [[ "${MATERIALIZE_TOTAL_EXPECTED}" -gt 0 ]]; then
    MATERIALIZE_PERCENT=$((PROCESSED_EXPECTED * 100 / MATERIALIZE_TOTAL_EXPECTED))
  elif [[ "${MATERIALIZE_TOTAL_STATES}" -gt 0 ]]; then
    MATERIALIZE_PERCENT=$((MATERIALIZE_COMPLETED_STATES * 100 / MATERIALIZE_TOTAL_STATES))
  fi
  if [[ "${MATERIALIZE_PERCENT}" -lt 1 && "${MATERIALIZE_QUEUE_INDEX}" -gt 0 ]]; then
    MATERIALIZE_PERCENT=1
  fi
  if [[ "${MATERIALIZE_PERCENT}" -gt 99 && ( "${MATERIALIZE_QUEUE_INDEX}" -lt "${MATERIALIZE_TOTAL_STATES}" || "${#MATERIALIZE_ACTIVE_PIDS[@]}" -gt 0 ) ]]; then
    MATERIALIZE_PERCENT=99
  fi

  ETA_SECONDS=0
  USE_DYNAMIC_RATE=0
  if [[ "${PROCESSED_EXPECTED}" -ge "${MATERIALIZE_RATE_MIN_ROWS_FOR_AVG}" || "${MATERIALIZE_COMPLETED_STATES}" -ge "${MATERIALIZE_RATE_MIN_STATES_FOR_AVG}" ]]; then
    USE_DYNAMIC_RATE=1
  fi

  if [[ "${USE_DYNAMIC_RATE}" -eq 1 && "${PROCESSED_EXPECTED}" -gt 0 && "${ELAPSED_SECONDS}" -gt 0 ]]; then
    MATERIALIZE_ROWS_PER_SECOND=$((PROCESSED_EXPECTED / ELAPSED_SECONDS))
    if [[ "${MATERIALIZE_ROWS_PER_SECOND}" -gt 0 ]]; then
      MATERIALIZE_REMAINING_EXPECTED=$((MATERIALIZE_TOTAL_EXPECTED - PROCESSED_EXPECTED))
      if [[ "${MATERIALIZE_REMAINING_EXPECTED}" -lt 0 ]]; then
        MATERIALIZE_REMAINING_EXPECTED=0
      fi
      ETA_SECONDS=$(((MATERIALIZE_REMAINING_EXPECTED + MATERIALIZE_ROWS_PER_SECOND - 1) / MATERIALIZE_ROWS_PER_SECOND))
    fi
  fi

  if [[ "${ETA_SECONDS}" -eq 0 && "${MATERIALIZE_TOTAL_EXPECTED}" -gt 0 ]]; then
    MATERIALIZE_REMAINING_EXPECTED=$((MATERIALIZE_TOTAL_EXPECTED - PROCESSED_EXPECTED))
    if [[ "${MATERIALIZE_REMAINING_EXPECTED}" -lt 0 ]]; then
      MATERIALIZE_REMAINING_EXPECTED=0
    fi
    ETA_SECONDS=$(((MATERIALIZE_REMAINING_EXPECTED + MATERIALIZE_BASELINE_ROWS_PER_SECOND - 1) / MATERIALIZE_BASELINE_ROWS_PER_SECOND))
  fi

  if [[ "${ETA_SECONDS}" -lt 0 ]]; then
    ETA_SECONDS=0
  fi
  ETA_LABEL="$(format_compact_duration_label "${ETA_SECONDS}")"

  ACTIVE_STATE_LABEL="none"
  if [[ "${#MATERIALIZE_ACTIVE_STATES[@]}" -gt 0 ]]; then
    ACTIVE_STATE_LABEL="$(IFS=,; printf '%s' "${MATERIALIZE_ACTIVE_STATES[*]}")"
  fi

  MATERIALIZE_BACKEND_PIDS="$(
    psql "$DB_URL" -Atqc \
      "SELECT pid
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND application_name LIKE '${MATERIALIZE_APP_NAME}-%'
         AND state = 'active'
       ORDER BY query_start" \
      2>/dev/null || true
  )"

  TEMP_BYTES=0
  if [[ -n "${MATERIALIZE_BACKEND_PIDS}" && -n "${PG_TMP_DIRECTORY}" && -d "${PG_TMP_DIRECTORY}" ]]; then
    while IFS= read -r backend_pid; do
      if [[ -z "${backend_pid}" ]]; then
        continue
      fi

      STATE_TEMP_BYTES="$((
        $(find "${PG_TMP_DIRECTORY}" -maxdepth 1 -type f -name "pgsql_tmp${backend_pid}.*" -exec stat -f '%z' {} + 2>/dev/null \
          | awk '{sum += $1} END {print sum + 0}')
      ))"
      if [[ "${STATE_TEMP_BYTES}" -gt 0 ]]; then
        TEMP_BYTES=$((TEMP_BYTES + STATE_TEMP_BYTES))
      fi
    done <<< "${MATERIALIZE_BACKEND_PIDS}"
  fi
  TEMP_LABEL="$(format_bytes_label "${TEMP_BYTES}")"

  update_active_status "db-load:materialize ${MATERIALIZE_PERCENT}/100 states=${MATERIALIZE_COMPLETED_STATES}/${MATERIALIZE_TOTAL_STATES} active=${ACTIVE_STATE_LABEL} elapsed=${ELAPSED_LABEL} eta=${ETA_LABEL} tmp=${TEMP_LABEL}"
}

update_active_status "db-load:materialize 0/100 states=0/${MATERIALIZE_TOTAL_STATES} active=none elapsed=0s eta=n/a tmp=0B"
MATERIALIZE_STARTED_AT="$(date +%s)"
MATERIALIZE_QUEUE_INDEX=0
MATERIALIZE_COMPLETED_STATES=0
MATERIALIZE_COMPLETED_EXPECTED=0
MATERIALIZE_FAILED_STATES=0
MATERIALIZE_FAILED_LABELS=()
while [[ "${MATERIALIZE_QUEUE_INDEX}" -lt "${MATERIALIZE_TOTAL_STATES}" || "${#MATERIALIZE_ACTIVE_PIDS[@]}" -gt 0 ]]; do
  while [[ "${MATERIALIZE_QUEUE_INDEX}" -lt "${MATERIALIZE_TOTAL_STATES}" && "${#MATERIALIZE_ACTIVE_PIDS[@]}" -lt "${MATERIALIZE_STATE_CONCURRENCY}" ]]; do
    NEXT_STATE="${MATERIALIZE_STATES[${MATERIALIZE_QUEUE_INDEX}]}"
    NEXT_EXPECTED="${MATERIALIZE_EXPECTED[${MATERIALIZE_QUEUE_INDEX}]}"
    NEXT_STATE_SAFE="$(printf '%s' "${NEXT_STATE}" | tr -c 'A-Z0-9_' '_')"
    STATE_LOG_PATH="${MATERIALIZE_STATE_LOG_ROOT}/materialize-${NEXT_STATE_SAFE}.log"

    run_materialize_state "${NEXT_STATE}" "${STATE_LOG_PATH}" &
    MATERIALIZE_ACTIVE_PIDS+=("$!")
    MATERIALIZE_ACTIVE_STATES+=("${NEXT_STATE}")
    MATERIALIZE_ACTIVE_EXPECTED+=("${NEXT_EXPECTED}")
    MATERIALIZE_QUEUE_INDEX=$((MATERIALIZE_QUEUE_INDEX + 1))
  done

  for ((active_idx=${#MATERIALIZE_ACTIVE_PIDS[@]} - 1; active_idx>=0; active_idx--)); do
    ACTIVE_PID="${MATERIALIZE_ACTIVE_PIDS[${active_idx}]}"
    ACTIVE_STATE="${MATERIALIZE_ACTIVE_STATES[${active_idx}]}"
    ACTIVE_EXPECTED="${MATERIALIZE_ACTIVE_EXPECTED[${active_idx}]}"

    if kill -0 "${ACTIVE_PID}" >/dev/null 2>&1; then
      continue
    fi

    if wait "${ACTIVE_PID}"; then
      MATERIALIZE_COMPLETED_STATES=$((MATERIALIZE_COMPLETED_STATES + 1))
      if [[ "${ACTIVE_EXPECTED}" =~ ^[0-9]+$ ]]; then
        MATERIALIZE_COMPLETED_EXPECTED=$((MATERIALIZE_COMPLETED_EXPECTED + ACTIVE_EXPECTED))
      fi
    else
      MATERIALIZE_FAILED_STATES=$((MATERIALIZE_FAILED_STATES + 1))
      MATERIALIZE_FAILED_LABELS+=("${ACTIVE_STATE}")
    fi

    unset 'MATERIALIZE_ACTIVE_PIDS[active_idx]'
    unset 'MATERIALIZE_ACTIVE_STATES[active_idx]'
    unset 'MATERIALIZE_ACTIVE_EXPECTED[active_idx]'
  done

  MATERIALIZE_ACTIVE_PIDS=("${MATERIALIZE_ACTIVE_PIDS[@]}")
  MATERIALIZE_ACTIVE_STATES=("${MATERIALIZE_ACTIVE_STATES[@]}")
  MATERIALIZE_ACTIVE_EXPECTED=("${MATERIALIZE_ACTIVE_EXPECTED[@]}")

  render_materialize_status
  if [[ "${MATERIALIZE_FAILED_STATES}" -gt 0 ]]; then
    terminate_materialize_workers
    break
  fi
  sleep "${MATERIALIZE_PROGRESS_INTERVAL_SECONDS}"
done

if [[ "${MATERIALIZE_FAILED_STATES}" -gt 0 ]]; then
  FAILED_LABELS="$(IFS=,; printf '%s' "${MATERIALIZE_FAILED_LABELS[*]}")"
  update_active_status "db-load:failed materialize-states=${FAILED_LABELS}"
  echo "[parcels] ERROR: materialize failed for states=${FAILED_LABELS}" >&2
  exit 3
fi

PGAPPNAME="${MATERIALIZE_APP_NAME}-finalize" psql "$DB_URL" -v ON_ERROR_STOP=1 -v stage_row_count="${STAGED_ROW_COUNT}" <<SQL
DO $$
DECLARE
  stage_count bigint := COALESCE(NULLIF(:'stage_row_count', '')::bigint, 0);
  build_count bigint;
  null_id_count bigint;
  null_geom_count bigint;
  invalid_geom_count bigint;
  duplicate_id_count bigint;
BEGIN
  SELECT COUNT(*) INTO build_count FROM parcel_build.parcels;

  IF stage_count = 0 THEN
    RAISE EXCEPTION 'Stage is empty. Nothing loaded.';
  END IF;

  IF build_count <> stage_count THEN
    RAISE EXCEPTION 'Row count mismatch after build: stage=% build=% dropped=%',
      stage_count,
      build_count,
      GREATEST(stage_count - build_count, 0);
  END IF;

  SELECT COUNT(*) INTO null_id_count
  FROM parcel_build.parcels
  WHERE parcel_id IS NULL OR length(trim(parcel_id)) = 0;
  IF null_id_count > 0 THEN
    RAISE EXCEPTION 'Invalid parcel_id rows: %', null_id_count;
  END IF;

  SELECT COUNT(*) INTO null_geom_count
  FROM parcel_build.parcels
  WHERE geom IS NULL OR geom_3857 IS NULL;
  IF null_geom_count > 0 THEN
    RAISE EXCEPTION 'Null geometry rows: %', null_geom_count;
  END IF;

  SELECT COUNT(*) INTO invalid_geom_count
  FROM parcel_build.parcels
  WHERE NOT ST_IsValid(geom) OR NOT ST_IsValid(geom_3857);
  IF invalid_geom_count > 0 THEN
    RAISE EXCEPTION 'Invalid geometry rows: %', invalid_geom_count;
  END IF;

  SELECT COUNT(*)
  INTO duplicate_id_count
  FROM (
    SELECT parcel_id
    FROM parcel_build.parcels
    GROUP BY parcel_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_id_count > 0 THEN
    RAISE EXCEPTION 'Duplicate parcel_id rows: %', duplicate_id_count;
  END IF;
END
$$;

ALTER TABLE parcel_build.parcels
  ADD CONSTRAINT parcels_build_pk PRIMARY KEY (parcel_id);

CREATE INDEX parcels_build_geom_3857_gist
  ON parcel_build.parcels USING gist (geom_3857);

CREATE INDEX parcels_build_geoid_idx
  ON parcel_build.parcels (geoid);

CREATE INDEX parcels_build_state2_idx
  ON parcel_build.parcels (state2);

ANALYZE parcel_build.parcels;
SQL

update_active_status "db-load:materialize 100/100 complete"

echo "[parcels] promoting parcel_build.parcels -> parcel_current.parcels"
update_active_status "db-load:swap-current"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT pg_advisory_lock(hashtext('parcel_swap_lock'));
DO \$\$
DECLARE
  archived_table_name text := format('parcels_prev_%s', '${BACKUP_SUFFIX}');
  constraint_record record;
  index_record record;
BEGIN
  IF to_regclass('parcel_current.parcels') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'parcel_current.parcels'::regclass
    LOOP
      EXECUTE format(
        'ALTER TABLE parcel_current.parcels RENAME CONSTRAINT %I TO %I',
        constraint_record.conname,
        left(constraint_record.conname || '_${BACKUP_SUFFIX}', 63)
      );
    END LOOP;

    FOR index_record IN
      SELECT cls.relname
      FROM pg_class AS cls
      INNER JOIN pg_index AS idx ON idx.indexrelid = cls.oid
      WHERE idx.indrelid = 'parcel_current.parcels'::regclass
    LOOP
      EXECUTE format(
        'ALTER INDEX parcel_current.%I RENAME TO %I',
        index_record.relname,
        left(index_record.relname || '_${BACKUP_SUFFIX}', 63)
      );
    END LOOP;

    IF to_regclass(format('parcel_history.%s', archived_table_name)) IS NOT NULL THEN
      EXECUTE format('DROP TABLE parcel_history.%I', archived_table_name);
    END IF;

    EXECUTE 'ALTER TABLE parcel_current.parcels SET SCHEMA parcel_history';
    EXECUTE format('ALTER TABLE parcel_history.parcels RENAME TO %I', archived_table_name);

    FOR index_record IN
      SELECT cls.relname
      FROM pg_class AS cls
      INNER JOIN pg_index AS idx ON idx.indexrelid = cls.oid
      WHERE idx.indrelid = format('parcel_history.%I', archived_table_name)::regclass
        AND NOT idx.indisprimary
        AND pg_get_indexdef(idx.indexrelid) NOT LIKE '%USING gist (geom_3857)%'
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS parcel_history.%I', index_record.relname);
    END LOOP;
  END IF;
END
\$\$;
ALTER TABLE parcel_build.parcels SET SCHEMA parcel_current;
SELECT pg_advisory_unlock(hashtext('parcel_swap_lock'));
COMMIT;
SQL

echo "[parcels] refreshing planner stats for parcel_current.parcels"
update_active_status "db-load:analyze-current"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
ALTER TABLE parcel_current.parcels
  SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 5000);

ANALYZE parcel_current.parcels;
SQL

echo "[parcels] pruning parcel history to newest ${PARCEL_HISTORY_RETAIN_COUNT} snapshots"
update_active_status "db-load:prune-history"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  archived_record record;
  retained_count integer := 0;
  keep_limit integer := ${PARCEL_HISTORY_RETAIN_COUNT};
BEGIN
  FOR archived_record IN
    SELECT cls.relname
    FROM pg_class AS cls
    INNER JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'parcel_history'
      AND cls.relkind = 'r'
      AND cls.relname LIKE 'parcels_prev_%'
    ORDER BY cls.relname DESC
  LOOP
    retained_count := retained_count + 1;
    IF retained_count > keep_limit THEN
      EXECUTE format('DROP TABLE parcel_history.%I', archived_record.relname);
    END IF;
  END LOOP;
END
\$\$;
SQL

echo "[parcels] recording parcel_meta.ingestion_runs + checkpoint state"
update_active_status "db-load:record-metadata"
psql "$DB_URL" -v ON_ERROR_STOP=1 \
  -v run_id="${RUN_ID}" \
  -v data_version="${DATA_VERSION}" \
  -v source_service="${SOURCE_SERVICE}" \
  -v started_at="${RUN_STARTED_AT}" \
  -v completed_at="${RUN_COMPLETED_AT}" \
  -v run_status="${RUN_STATUS}" \
  -v notes_json="${RUN_NOTES}" <<'SQL'
INSERT INTO parcel_meta.ingestion_runs (
  run_id,
  data_version,
  source_service,
  started_at,
  completed_at,
  status,
  notes
)
VALUES (
  :'run_id'::text,
  :'data_version'::date,
  :'source_service'::text,
  :'started_at'::timestamptz,
  :'completed_at'::timestamptz,
  :'run_status'::text,
  COALESCE(NULLIF(:'notes_json', '')::jsonb, '{}'::jsonb)
)
ON CONFLICT (run_id)
DO UPDATE SET
  data_version = EXCLUDED.data_version,
  source_service = EXCLUDED.source_service,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;
SQL

if [[ -d "${INPUT}" ]]; then
  CHECKPOINT_FILES=("${INPUT}"/state-*.checkpoint.json)
  for checkpoint_file in "${CHECKPOINT_FILES[@]}"; do
    [[ -e "${checkpoint_file}" ]] || continue

    STATE2="$(jq -r '.state // empty' "${checkpoint_file}" 2>/dev/null || true)"
    if [[ -z "${STATE2}" ]]; then
      continue
    fi

    LAST_SOURCE_OID="$(jq -r '.lastSourceId // empty' "${checkpoint_file}" 2>/dev/null || true)"
    EXPECTED_COUNT="$(jq -r '.expectedCount // 0' "${checkpoint_file}" 2>/dev/null || echo "0")"
    PAGES_FETCHED="$(jq -r '.pagesFetched // 0' "${checkpoint_file}" 2>/dev/null || echo "0")"
    ROWS_WRITTEN="$(jq -r '.writtenCount // 0' "${checkpoint_file}" 2>/dev/null || echo "0")"
    UPDATED_AT="$(jq -r '.updatedAt // empty' "${checkpoint_file}" 2>/dev/null || true)"

    CHECKPOINT_STATUS="completed"
    if [[ "${ROWS_WRITTEN}" == "0" && "${PAGES_FETCHED}" == "0" ]]; then
      CHECKPOINT_STATUS="empty"
    fi

    psql "$DB_URL" -v ON_ERROR_STOP=1 \
      -v run_id="${RUN_ID}" \
      -v state2="${STATE2}" \
      -v shard_id="state" \
      -v last_source_oid="${LAST_SOURCE_OID}" \
      -v expected_count="${EXPECTED_COUNT}" \
      -v pages_fetched="${PAGES_FETCHED}" \
      -v rows_written="${ROWS_WRITTEN}" \
      -v checkpoint_status="${CHECKPOINT_STATUS}" \
      -v updated_at="${UPDATED_AT}" <<'SQL'
INSERT INTO parcel_meta.ingestion_checkpoints (
  run_id,
  state2,
  shard_id,
  last_source_oid,
  expected_count,
  pages_fetched,
  rows_written,
  status,
  updated_at
)
VALUES (
  :'run_id'::text,
  :'state2'::char(2),
  :'shard_id'::text,
  CASE
    WHEN NULLIF(:'last_source_oid', '') IS NULL THEN NULL
    ELSE NULLIF(:'last_source_oid', '')::bigint
  END,
  COALESCE(NULLIF(:'expected_count', '')::bigint, 0),
  COALESCE(NULLIF(:'pages_fetched', '')::integer, 0),
  COALESCE(NULLIF(:'rows_written', '')::bigint, 0),
  :'checkpoint_status'::text,
  CASE
    WHEN NULLIF(:'updated_at', '') IS NULL THEN now()
    ELSE NULLIF(:'updated_at', '')::timestamptz
  END
)
ON CONFLICT (run_id, state2, shard_id)
DO UPDATE SET
  last_source_oid = EXCLUDED.last_source_oid,
  expected_count = EXCLUDED.expected_count,
  pages_fetched = EXCLUDED.pages_fetched,
  rows_written = EXCLUDED.rows_written,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;
SQL
  done
fi

echo "[parcels] load-and-swap complete. current=parcel_current.parcels runId=${RUN_ID}"
update_active_status "db-load:complete"
