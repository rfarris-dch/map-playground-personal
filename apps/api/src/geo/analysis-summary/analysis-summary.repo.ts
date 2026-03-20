import { equalAreaSqKmSql } from "@/db/postgis-analysis-sql.service";
import { runQuery } from "@/db/postgres";
import type {
  AnalysisSummaryAreaRow,
  AnalysisSummaryMarketBoundarySourceVersionRow,
  AnalysisSummaryMarketInsightRow,
} from "./analysis-summary.repo.types";

export type {
  AnalysisSummaryAreaRow,
  AnalysisSummaryMarketBoundarySourceVersionRow,
  AnalysisSummaryMarketInsightRow,
} from "./analysis-summary.repo.types";

export function listIntersectedCountyIds(
  geometryGeoJson: string
): Promise<readonly AnalysisSummaryAreaRow[]> {
  return runQuery<AnalysisSummaryAreaRow>(
    `
WITH selection AS (
  SELECT
    ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom_4326,
    ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS bbox_4326,
    ${equalAreaSqKmSql("ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)")} AS selection_area_sq_km
),
intersections AS (
  SELECT county.county_fips::text AS county_fips
  FROM serve.boundary_county_geom_lod1 AS county
  CROSS JOIN selection
  WHERE county.geom && selection.bbox_4326
    AND ST_Intersects(county.geom, selection.geom_4326)
)
SELECT
  intersections.county_fips,
  selection.selection_area_sq_km
FROM selection
LEFT JOIN intersections
  ON TRUE
ORDER BY intersections.county_fips ASC NULLS LAST;
`,
    [geometryGeoJson]
  );
}

export async function getMarketBoundarySourceVersion(): Promise<string | null> {
  const rows = await runQuery<AnalysisSummaryMarketBoundarySourceVersionRow>(
    `
SELECT MAX(source_version)::text AS source_version
FROM market_current.market_boundaries;
`,
    []
  );

  return rows[0]?.source_version ?? null;
}

export async function getMarketInsightByMarketId(
  marketId: string
): Promise<AnalysisSummaryMarketInsightRow | null> {
  const rows = await runQuery<AnalysisSummaryMarketInsightRow>(
    `
WITH requested_market AS (
  SELECT canon.stable_uuid('market', $1) AS market_uuid
)
SELECT
  insight_rows.market_id::text AS market_id,
  insight_rows.market_name,
  insight_rows.period_label,
  insight_rows.colo_commissioned_mw AS colocation_commissioned_mw,
  insight_rows.hyperscale_owned_mw,
  insight_rows.total_market_size_mw,
  insight_rows.preleasing_mw,
  insight_rows.preleasing_pct_of_absorption,
  insight_rows.preleasing_pct_of_commissioned,
  insight_rows.growth_year_num::integer AS growth_year,
  insight_rows.growth_ratio,
  insight_rows.source_basis
FROM requested_market
INNER JOIN serve.market_insight_live AS insight_rows
  ON insight_rows.market_id = requested_market.market_uuid;
`,
    [marketId]
  );

  return rows[0] ?? null;
}
