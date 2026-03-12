import { runQuery } from "@/db/postgres";
import type { MarketSelectionRow, MarketsSelectionQuery } from "./markets-selection.repo.types";

export type { MarketSelectionRow } from "./markets-selection.repo.types";

export function listMarketsBySelection(
  query: MarketsSelectionQuery
): Promise<readonly MarketSelectionRow[]> {
  return runQuery<MarketSelectionRow>(
    `
WITH selection AS (
  SELECT
    ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom_4326,
    ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857)) / 1000000.0
      AS selection_area_sq_km
),
matches AS (
  SELECT
    boundary.market_id,
    COALESCE(NULLIF(BTRIM(market.name), ''), boundary.market_id) AS name,
    NULLIF(BTRIM(market.region), '') AS region,
    NULLIF(BTRIM(market.country), '') AS country,
    NULLIF(BTRIM(market.state), '') AS state,
    market.absorption,
    market.vacancy,
    COALESCE(market.updated_at, boundary.imported_at) AS updated_at,
    COALESCE(ST_X(boundary.center), ST_X(ST_PointOnSurface(boundary.geom))) AS longitude,
    COALESCE(ST_Y(boundary.center), ST_Y(ST_PointOnSurface(boundary.geom))) AS latitude,
    selection.selection_area_sq_km AS selection_area_sq_km,
    ST_Area(ST_Transform(boundary.geom, 3857)) / 1000000.0 AS market_area_sq_km,
    ST_Area(ST_Transform(ST_Intersection(boundary.geom, selection.geom_4326), 3857)) / 1000000.0
      AS intersection_area_sq_km
  FROM market_current.market_boundaries AS boundary
  LEFT JOIN market_current.markets AS market
    ON market.market_id = boundary.market_id
  CROSS JOIN selection
  WHERE boundary.market_id IS NOT NULL
    AND ST_Intersects(boundary.geom, selection.geom_4326)
)
SELECT
  market_id,
  name,
  region,
  country,
  state,
  absorption,
  vacancy,
  updated_at,
  longitude,
  latitude,
  selection_area_sq_km,
  market_area_sq_km,
  intersection_area_sq_km
FROM matches
WHERE selection_area_sq_km > 0
  AND (intersection_area_sq_km / selection_area_sq_km) >= $2
ORDER BY
  (intersection_area_sq_km / selection_area_sq_km) DESC,
  intersection_area_sq_km DESC,
  name ASC NULLS LAST,
  market_id ASC
LIMIT $3;
`,
    [query.geometryGeoJson, query.minimumSelectionOverlapPercent, query.limit]
  );
}
