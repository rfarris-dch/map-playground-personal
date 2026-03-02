export type QueryName =
  | "facilities_bbox_colocation"
  | "facilities_bbox_hyperscale"
  | "facility_detail_colocation"
  | "facility_detail_hyperscale"
  | "county_metrics"
  | "parcel_detail";

export interface QuerySpec {
  endpointClass: "feature-collection" | "administrative-aggregation" | "proximity-enrichment";
  maxRows: number;
  name: QueryName;
  sql: string;
}

export const QUERY_SPECS: Record<QueryName, QuerySpec> = {
  facilities_bbox_colocation: {
    name: "facilities_bbox_colocation",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
)
SELECT
  facility_id,
  provider_id,
  county_fips,
  commissioned_power_mw,
  commissioned_semantic,
  NULL::text AS lease_or_own,
  ST_AsGeoJSON(geom)::jsonb AS geom_json
FROM serve.facility_site, bounds
WHERE geom_3857 && bounds.bbox_3857
  AND ST_Intersects(geom_3857, bounds.bbox_3857)
LIMIT $5;`,
  },
  facilities_bbox_hyperscale: {
    name: "facilities_bbox_hyperscale",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
)
SELECT
  hyperscale_id AS facility_id,
  provider_id,
  county_fips,
  commissioned_power_mw,
  commissioned_semantic,
  lease_or_own,
  ST_AsGeoJSON(geom)::jsonb AS geom_json
FROM serve.hyperscale_site, bounds
WHERE geom_3857 && bounds.bbox_3857
  AND ST_Intersects(geom_3857, bounds.bbox_3857)
LIMIT $5;`,
  },
  facility_detail_colocation: {
    name: "facility_detail_colocation",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  facility_id,
  provider_id,
  county_fips,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  commissioned_semantic,
  NULL::text AS lease_or_own,
  ST_AsGeoJSON(geom)::jsonb AS geom_json
FROM serve.facility_site
WHERE facility_id = $1
LIMIT 1;`,
  },
  facility_detail_hyperscale: {
    name: "facility_detail_hyperscale",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  hyperscale_id AS facility_id,
  provider_id,
  county_fips,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  commissioned_semantic,
  lease_or_own,
  ST_AsGeoJSON(geom)::jsonb AS geom_json
FROM serve.hyperscale_site
WHERE hyperscale_id = $1
LIMIT 1;`,
  },
  county_metrics: {
    name: "county_metrics",
    endpointClass: "administrative-aggregation",
    maxRows: 4000,
    sql: `
SELECT
  county_fips,
  composite_score,
  demand_score,
  generation_score,
  policy_score,
  formula_version,
  input_data_version
FROM analytics.county_scores_v1;`,
  },
  parcel_detail: {
    name: "parcel_detail",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  parcel_id,
  county_fips,
  state_abbrev,
  acreage,
  ST_AsGeoJSON(geom)::jsonb AS geom_json
FROM serve.parcel
WHERE parcel_id = $1
LIMIT 1;`,
  },
};

export function getQuerySpec(name: QueryName): QuerySpec {
  return QUERY_SPECS[name];
}
