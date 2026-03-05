import type { BoundaryPowerLevel } from "@map-migration/contracts";
import { runQuery } from "@/db/postgres";
import type { BoundaryPowerRow } from "./boundaries.repo.types";

export type { BoundaryPowerRow } from "./boundaries.repo.types";

const FACILITY_POWER_CTE = `
WITH facility_power AS (
  SELECT
    county_fips,
    SUM(COALESCE(commissioned_power_mw, 0))::double precision AS commissioned_power_mw
  FROM (
    SELECT county_fips, commissioned_power_mw FROM serve.facility_site
    UNION ALL
    SELECT county_fips, commissioned_power_mw FROM serve.hyperscale_site
  ) AS all_facilities
  GROUP BY county_fips
)`;

const COUNTY_POWER_SQL = `
${FACILITY_POWER_CTE}
SELECT
  county.county_fips::text AS region_id,
  county.county_name::text AS region_name,
  county.state_abbrev::text AS parent_region_name,
  COALESCE(facility_power.commissioned_power_mw, 0)::double precision AS commissioned_power_mw,
  ST_AsGeoJSON(county.geom)::jsonb AS geom_json
FROM serve.admin_county_geom_lod1 AS county
LEFT JOIN facility_power ON facility_power.county_fips = county.county_fips;`;

const STATE_POWER_SQL = `
${FACILITY_POWER_CTE},
state_power AS (
  SELECT
    LEFT(county_fips, 2)::text AS state_fips,
    SUM(commissioned_power_mw)::double precision AS commissioned_power_mw
  FROM facility_power
  GROUP BY LEFT(county_fips, 2)
)
SELECT
  LEFT(county.county_fips, 2)::text AS region_id,
  MAX(county.state_abbrev)::text AS region_name,
  'United States'::text AS parent_region_name,
  COALESCE(state_power.commissioned_power_mw, 0)::double precision AS commissioned_power_mw,
  ST_AsGeoJSON(ST_Multi(ST_Union(county.geom)))::jsonb AS geom_json
FROM serve.admin_county_geom_lod2 AS county
LEFT JOIN state_power ON state_power.state_fips = LEFT(county.county_fips, 2)
GROUP BY LEFT(county.county_fips, 2), state_power.commissioned_power_mw;`;

const COUNTRY_POWER_SQL = `
${FACILITY_POWER_CTE},
country_geom AS (
  SELECT ST_AsGeoJSON(ST_Multi(ST_Union(county.geom)))::jsonb AS geom_json
  FROM serve.admin_county_geom_lod3 AS county
),
total_power AS (
  SELECT COALESCE(SUM(commissioned_power_mw), 0)::double precision AS commissioned_power_mw
  FROM facility_power
)
SELECT
  'US'::text AS region_id,
  'United States'::text AS region_name,
  NULL::text AS parent_region_name,
  total_power.commissioned_power_mw,
  country_geom.geom_json
FROM country_geom
CROSS JOIN total_power
WHERE country_geom.geom_json IS NOT NULL;`;

function sqlForLevel(level: BoundaryPowerLevel): string {
  if (level === "county") {
    return COUNTY_POWER_SQL;
  }

  if (level === "state") {
    return STATE_POWER_SQL;
  }

  return COUNTRY_POWER_SQL;
}

export function listBoundaryPower(level: BoundaryPowerLevel): Promise<BoundaryPowerRow[]> {
  return runQuery<BoundaryPowerRow>(sqlForLevel(level), []);
}
