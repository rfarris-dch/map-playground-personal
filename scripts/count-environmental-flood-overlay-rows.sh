#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL_VALUE="${ENVIRONMENTAL_FLOOD_DATABASE_URL:-${DATABASE_URL:-}}"
RUN_ID="${1:-}"
SUBDIVIDE_VERTICES="${ENVIRONMENTAL_FLOOD_SUBDIVIDE_VERTICES:-255}"

quote_sql_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "${value}"
}

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "[count] ERROR: DATABASE_URL or ENVIRONMENTAL_FLOOD_DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  echo "[count] ERROR: usage: scripts/count-environmental-flood-overlay-rows.sh <run-id>" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[count] ERROR: missing dependency in PATH: psql" >&2
  exit 1
fi

RUN_ID_SQL="$(quote_sql_literal "${RUN_ID}")"

echo "[count] computing exact reduced flood overlay row total for ${RUN_ID}" >&2
echo "[count] subdivide=${SUBDIVIDE_VERTICES}" >&2

PGAPPNAME="flood-overlay-exact-count" \
psql "${DATABASE_URL_VALUE}" \
  -v ON_ERROR_STOP=1 \
  -At \
  -c "
WITH flood_overlay_source AS (
  SELECT
    COALESCE(flood.dfirm_id, 'unknown') AS dfirm_id,
    flood.is_flood_100,
    flood.is_flood_500,
    flood.flood_band,
    flood.legend_key,
    flood.data_version,
    ST_CollectionExtract(ST_MakeValid(flood.geom_3857), 3) AS geom_3857
  FROM environmental_current.flood_hazard AS flood
  WHERE flood.run_id = ${RUN_ID_SQL}
    AND (flood.is_flood_100 OR flood.is_flood_500)
),
flood_overlay_groups AS (
  SELECT
    source.dfirm_id,
    source.is_flood_100,
    source.is_flood_500,
    source.flood_band,
    source.legend_key,
    source.data_version,
    ST_CollectionExtract(ST_MakeValid(ST_UnaryUnion(ST_Collect(source.geom_3857))), 3) AS geom_3857
  FROM flood_overlay_source AS source
  WHERE NOT ST_IsEmpty(source.geom_3857)
  GROUP BY
    source.dfirm_id,
    source.is_flood_100,
    source.is_flood_500,
    source.flood_band,
    source.legend_key,
    source.data_version
),
flood_overlay_parts AS (
  SELECT
    groups.dfirm_id,
    groups.is_flood_100,
    groups.is_flood_500,
    groups.flood_band,
    groups.legend_key,
    groups.data_version,
    dumped.geom AS geom_3857
  FROM flood_overlay_groups AS groups
  CROSS JOIN LATERAL ST_Dump(groups.geom_3857) AS dumped
),
flood_overlay_subdivided AS (
  SELECT
    parts.dfirm_id,
    parts.is_flood_100,
    parts.is_flood_500,
    parts.flood_band,
    parts.legend_key,
    parts.data_version,
    ST_CollectionExtract(ST_MakeValid(subdivided.geom), 3) AS geom_3857
  FROM flood_overlay_parts AS parts
  CROSS JOIN LATERAL ST_Subdivide(parts.geom_3857, ${SUBDIVIDE_VERTICES}) AS subdivided(geom)
)
SELECT count(*)
FROM flood_overlay_subdivided
WHERE NOT ST_IsEmpty(geom_3857);
"
