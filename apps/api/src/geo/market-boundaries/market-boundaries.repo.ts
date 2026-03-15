import type { MarketBoundaryLevel } from "@map-migration/http-contracts/market-boundaries-http";
import { runQuery } from "@/db/postgres";
import type { MarketBoundaryRow } from "./market-boundaries.repo.types";

export type { MarketBoundaryRow } from "./market-boundaries.repo.types";

const MARKET_BOUNDARY_SQL = `
WITH market_power AS (
  SELECT
    mb.market_id,
    SUM(COALESCE(fs.commissioned_power_mw, 0))::double precision AS commissioned_power_mw
  FROM market_current.market_boundaries mb
  LEFT JOIN serve.facility_site fs ON ST_Contains(mb.geom, fs.geom)
  GROUP BY mb.market_id
)
SELECT
  m.market_id::text AS region_id,
  m.name::text AS region_name,
  NULL::text AS parent_region_name,
  m.market_id::text AS market_id,
  m.absorption::double precision AS absorption,
  m.vacancy::double precision AS vacancy,
  COALESCE(mp.commissioned_power_mw, 0)::double precision AS commissioned_power_mw,
  ST_AsGeoJSON(mb.geom)::jsonb AS geom_json
FROM market_current.markets m
JOIN market_current.market_boundaries mb ON mb.market_id = m.market_id
LEFT JOIN market_power mp ON mp.market_id = m.market_id;`;

const SUBMARKET_BOUNDARY_SQL = `
SELECT
  sb.submarket_id::text AS region_id,
  sb.submarket_name::text AS region_name,
  sb.market_name::text AS parent_region_name,
  sb.market_id::text AS market_id,
  NULL::double precision AS absorption,
  NULL::double precision AS vacancy,
  NULL::double precision AS commissioned_power_mw,
  ST_AsGeoJSON(sb.geom)::jsonb AS geom_json
FROM market_current.submarket_boundaries sb;`;

function sqlForLevel(level: MarketBoundaryLevel): string {
  if (level === "market") {
    return MARKET_BOUNDARY_SQL;
  }

  return SUBMARKET_BOUNDARY_SQL;
}

export function listMarketBoundaries(level: MarketBoundaryLevel): Promise<MarketBoundaryRow[]> {
  return runQuery<MarketBoundaryRow>(sqlForLevel(level), []);
}
