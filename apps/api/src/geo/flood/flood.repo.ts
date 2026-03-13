import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import { equalAreaSqKmSql } from "@/db/postgis-analysis-sql.service";
import { runQuery } from "@/db/postgres";
import type { FloodAreaSummaryRow, FloodParcelRollupRow } from "./flood.repo.types";

export type { FloodAreaSummaryRow, FloodParcelRollupRow } from "./flood.repo.types";

const DEFAULT_FLOOD_QUERY_STATEMENT_TIMEOUT_MS = parsePositiveIntFlag(
  process.env.API_FLOOD_QUERY_STATEMENT_TIMEOUT_MS,
  15_000
);

export function queryFloodAreaSummary(
  geometryGeoJson: string
): Promise<readonly FloodAreaSummaryRow[]> {
  return runQuery<FloodAreaSummaryRow>(
    `
WITH selection AS (
  SELECT
    ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom_4326,
    ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857,
    ${equalAreaSqKmSql("ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)")} AS selection_area_sq_km
),
dataset_meta AS (
  SELECT
    1::bigint AS dataset_feature_count,
    data_version::text AS data_version,
    run_id::text AS run_id
  FROM environmental_current.flood_hazard
  LIMIT 1
),
flood_100 AS (
  SELECT ST_UnaryUnion(ST_Collect(ST_Intersection(flood.geom_3857, selection.geom_3857))) AS geom
  FROM environmental_current.flood_hazard AS flood
  CROSS JOIN selection
  WHERE flood.is_flood_100
    AND flood.geom_3857 && selection.geom_3857
    AND ST_Intersects(flood.geom_3857, selection.geom_3857)
),
flood_500 AS (
  SELECT ST_UnaryUnion(ST_Collect(ST_Intersection(flood.geom_3857, selection.geom_3857))) AS geom
  FROM environmental_current.flood_hazard AS flood
  CROSS JOIN selection
  WHERE flood.is_flood_500
    AND flood.geom_3857 && selection.geom_3857
    AND ST_Intersects(flood.geom_3857, selection.geom_3857)
)
SELECT
  dataset_meta.data_version,
  dataset_meta.dataset_feature_count,
  COALESCE(${equalAreaSqKmSql("flood_100.geom")}, 0) AS flood100_area_sq_km,
  COALESCE(${equalAreaSqKmSql("flood_500.geom")}, 0) AS flood500_area_sq_km,
  dataset_meta.run_id,
  selection.selection_area_sq_km
FROM selection
CROSS JOIN dataset_meta
CROSS JOIN flood_100
CROSS JOIN flood_500;
`,
    [geometryGeoJson],
    {
      statementTimeoutMs: DEFAULT_FLOOD_QUERY_STATEMENT_TIMEOUT_MS,
    }
  );
}

export function queryFloodParcelRollup(
  geometryGeoJson: string
): Promise<readonly FloodParcelRollupRow[]> {
  return runQuery<FloodParcelRollupRow>(
    `
WITH selection AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
),
selected_parcels AS (
  SELECT parcel.parcel_id, parcel.geom_3857
  FROM parcel_current.parcels AS parcel
  CROSS JOIN selection
  WHERE parcel.geom_3857 && selection.geom_3857
    AND ST_Intersects(parcel.geom_3857, selection.geom_3857)
),
parcel_flood_rollup AS (
  SELECT
    selected_parcels.parcel_id,
    COALESCE(BOOL_OR(flood.is_flood_100), FALSE) AS intersects_flood_100,
    COALESCE(BOOL_OR(flood.is_flood_500), FALSE) AS intersects_flood_500
  FROM selected_parcels
  LEFT JOIN environmental_current.flood_hazard AS flood
    ON flood.geom_3857 && selected_parcels.geom_3857
   AND ST_Intersects(flood.geom_3857, selected_parcels.geom_3857)
  GROUP BY selected_parcels.parcel_id
)
SELECT
  COUNT(*) FILTER (WHERE intersects_flood_100) AS parcel_count_intersecting_flood_100,
  COUNT(*) FILTER (WHERE intersects_flood_500) AS parcel_count_intersecting_flood_500,
  COUNT(*) FILTER (WHERE NOT intersects_flood_100 AND NOT intersects_flood_500)
    AS parcel_count_outside_mapped_flood,
  COUNT(*) AS selected_parcel_count
FROM parcel_flood_rollup;
`,
    [geometryGeoJson],
    {
      statementTimeoutMs: DEFAULT_FLOOD_QUERY_STATEMENT_TIMEOUT_MS,
    }
  );
}
