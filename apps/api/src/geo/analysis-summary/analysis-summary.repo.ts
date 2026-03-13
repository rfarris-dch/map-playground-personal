import { equalAreaSqKmSql } from "@/db/postgis-analysis-sql.service";
import { runQuery } from "@/db/postgres";
import type {
  AnalysisSummaryAreaRow,
  AnalysisSummaryMarketBoundarySourceVersionRow,
} from "./analysis-summary.repo.types";

export type {
  AnalysisSummaryAreaRow,
  AnalysisSummaryMarketBoundarySourceVersionRow,
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
