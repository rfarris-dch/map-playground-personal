/**
 * Shared CTE that aggregates commissioned power per county
 * from both colo (facility_site) and hyperscale sites.
 *
 * Used by boundary-power queries and any future facilities-level rollups.
 */
export const FACILITY_POWER_CTE = `
WITH facility_power AS (
  SELECT
    county_fips,
    SUM(COALESCE(commissioned_power_mw, 0))::double precision AS commissioned_power_mw
  FROM (
    SELECT county_fips, commissioned_power_mw
    FROM serve.facility_site
    WHERE county_fips ~ '^[0-9]{5}$'
    UNION ALL
    SELECT county_fips, commissioned_power_mw
    FROM serve.hyperscale_site
    WHERE county_fips ~ '^[0-9]{5}$'
  ) AS all_facilities
  GROUP BY county_fips
)`;
