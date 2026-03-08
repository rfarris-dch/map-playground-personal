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
    ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857)) / 1000000.0
      AS selection_area_sq_km
)
SELECT
  county.county_fips::text AS county_fips,
  selection.selection_area_sq_km
FROM serve.boundary_county_geom_lod1 AS county
CROSS JOIN selection
WHERE ST_Intersects(county.geom, selection.geom_4326)
ORDER BY county.county_fips ASC;
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
