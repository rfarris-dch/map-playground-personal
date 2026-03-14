import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  FacilitiesBboxSqlQueryArgs,
  FacilitiesPolygonSqlQueryArgs,
  FacilityDetailSqlQueryArgs,
  ParcelBboxFilter,
  ParcelEnrichQueryOptions,
  ParcelGeometryModeSql,
  ParcelSqlQuery,
  SqlQuerySpec,
} from "./index.types";

export type {
  FacilitiesBboxSqlQueryArgs,
  FacilitiesPolygonSqlQueryArgs,
  FacilityDetailSqlQueryArgs,
  ParcelBboxFilter,
  ParcelEnrichQueryOptions,
  ParcelGeometryModeSql,
  ParcelSqlQuery,
  SqlQuerySpec,
} from "./index.types";

type QueryName =
  | "facilities_bbox_colocation"
  | "facilities_bbox_hyperscale"
  | "facilities_polygon_colocation"
  | "facilities_polygon_hyperscale"
  | "facility_detail_colocation"
  | "facility_detail_hyperscale"
  | "county_metrics";

type RegisteredQuerySpec = SqlQuerySpec & {
  readonly name: QueryName;
};

const QUERY_SPECS: Record<QueryName, RegisteredQuerySpec> = {
  facilities_bbox_colocation: {
    name: "facilities_bbox_colocation",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
),
candidates AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_slug,
    facility.county_fips,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    facility.commissioned_semantic,
    facility.geom
  FROM serve.facility_site AS facility, bounds
  WHERE facility.geom_3857 && bounds.bbox_3857
    AND ST_Intersects(facility.geom_3857, bounds.bbox_3857)
    AND facility.provider_id IS NOT NULL
  LIMIT $5
)
SELECT
  c.facility_id,
  c.facility_name,
  c.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(c.provider_slug, '-', ' ')), ''),
    c.provider_id
  ) AS provider_name,
  COALESCE(c.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(c.state_abbrev), '') AS state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  c.available_power_mw,
  NULL::numeric AS square_footage,
  c.commissioned_semantic,
  NULL::text AS lease_or_own,
  NULL::text AS status_label,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  ST_AsGeoJSON(c.geom)::jsonb AS geom_json
FROM candidates AS c
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = c.provider_id;`,
  },
  facilities_bbox_hyperscale: {
    name: "facilities_bbox_hyperscale",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
),
candidates AS (
  SELECT
    facility.hyperscale_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_slug,
    facility.county_fips,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.commissioned_semantic,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.lease_or_own,
    facility.geom
  FROM serve.hyperscale_site AS facility, bounds
  WHERE facility.geom_3857 && bounds.bbox_3857
    AND ST_Intersects(facility.geom_3857, bounds.bbox_3857)
    AND facility.provider_id IS NOT NULL
  LIMIT $5
)
SELECT
  c.hyperscale_id AS facility_id,
  c.facility_name,
  c.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(c.provider_slug, '-', ' ')), ''),
    c.provider_id
  ) AS provider_name,
  COALESCE(c.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(c.state_abbrev), '') AS state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  NULL::numeric AS square_footage,
  c.commissioned_semantic,
  c.lease_or_own,
  NULL::text AS status_label,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  ST_AsGeoJSON(c.geom)::jsonb AS geom_json
FROM candidates AS c
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = c.provider_id;`,
  },
  facilities_polygon_colocation: {
    name: "facilities_polygon_colocation",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
),
candidates AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_slug,
    facility.county_fips,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    facility.commissioned_semantic,
    facility.geom
  FROM serve.facility_site AS facility, aoi
  WHERE facility.geom_3857 && aoi.geom_3857
    AND ST_Intersects(facility.geom_3857, aoi.geom_3857)
    AND facility.provider_id IS NOT NULL
  LIMIT $2
)
SELECT
  c.facility_id,
  c.facility_name,
  c.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(c.provider_slug, '-', ' ')), ''),
    c.provider_id
  ) AS provider_name,
  COALESCE(c.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(c.state_abbrev), '') AS state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  c.available_power_mw,
  NULL::numeric AS square_footage,
  c.commissioned_semantic,
  NULL::text AS lease_or_own,
  NULL::text AS status_label,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  ST_AsGeoJSON(c.geom)::jsonb AS geom_json
FROM candidates AS c
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = c.provider_id;`,
  },
  facilities_polygon_hyperscale: {
    name: "facilities_polygon_hyperscale",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
),
candidates AS (
  SELECT
    facility.hyperscale_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_slug,
    facility.county_fips,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.commissioned_semantic,
    facility.lease_or_own,
    facility.geom
  FROM serve.hyperscale_site AS facility, aoi
  WHERE facility.geom_3857 && aoi.geom_3857
    AND ST_Intersects(facility.geom_3857, aoi.geom_3857)
    AND facility.provider_id IS NOT NULL
  LIMIT $2
)
SELECT
  c.hyperscale_id AS facility_id,
  c.facility_name,
  c.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(c.provider_slug, '-', ' ')), ''),
    c.provider_id
  ) AS provider_name,
  COALESCE(c.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(c.state_abbrev), '') AS state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  NULL::numeric AS square_footage,
  c.commissioned_semantic,
  c.lease_or_own,
  NULL::text AS status_label,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  ST_AsGeoJSON(c.geom)::jsonb AS geom_json
FROM candidates AS c
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = c.provider_id;`,
  },
  facility_detail_colocation: {
    name: "facility_detail_colocation",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  facility.facility_id,
  facility.facility_name,
  facility.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(facility.provider_slug, '-', ' ')), ''),
    facility.provider_id
  ) AS provider_name,
  COALESCE(facility.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  facility.available_power_mw,
  NULL::numeric AS square_footage,
  facility.commissioned_semantic,
  NULL::text AS lease_or_own,
  NULL::text AS status_label,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  ST_AsGeoJSON(facility.geom)::jsonb AS geom_json
FROM serve.facility_site AS facility
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = facility.provider_id
WHERE facility.facility_id = $1
  AND facility.geom IS NOT NULL
  AND facility.provider_id IS NOT NULL
LIMIT 1;`,
  },
  facility_detail_hyperscale: {
    name: "facility_detail_hyperscale",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  facility.hyperscale_id AS facility_id,
  facility.facility_name,
  facility.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(facility.provider_slug, '-', ' ')), ''),
    facility.provider_id
  ) AS provider_name,
  COALESCE(facility.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  NULL::numeric AS square_footage,
  facility.commissioned_semantic,
  facility.lease_or_own,
  NULL::text AS status_label,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  ST_AsGeoJSON(facility.geom)::jsonb AS geom_json
FROM serve.hyperscale_site AS facility
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = facility.provider_id
WHERE facility.hyperscale_id = $1
  AND facility.geom IS NOT NULL
  AND facility.provider_id IS NOT NULL
LIMIT 1;`,
  },
  county_metrics: {
    name: "county_metrics",
    endpointClass: "boundary-aggregation",
    maxRows: 4000,
    sql: `
SELECT
  county_geoid AS county_fips,
  publication_run_id,
  rank_status,
  attractiveness_tier,
  confidence_badge,
  market_pressure_index,
  demand_pressure_score,
  supply_timeline_score,
  grid_friction_score,
  policy_constraint_score,
  freshness_score,
  source_volatility,
  last_updated_at,
  narrative_summary,
  top_drivers_json,
  deferred_reason_codes_json,
  what_changed_30d_json,
  what_changed_60d_json,
  what_changed_90d_json,
  pillar_value_states_json,
  expected_mw_0_24m,
  expected_mw_24_60m,
  recent_commissioned_mw_24m,
  demand_momentum_qoq,
  provider_entry_count_12m,
  expected_supply_mw_0_36m,
  expected_supply_mw_36_60m,
  signed_ia_mw,
  queue_mw_active,
  queue_project_count_active,
  median_days_in_queue_active,
  past_due_share,
  market_withdrawal_prior,
  congestion_proxy_score,
  planned_upgrade_count,
  heatmap_signal_flag,
  policy_momentum_score,
  moratorium_status,
  public_sentiment_score,
  policy_event_count,
  county_tagged_event_share,
  policy_mapping_confidence,
  transmission_miles_69kv_plus,
  transmission_miles_230kv_plus,
  gas_pipeline_presence_flag,
  gas_pipeline_mileage_county,
  fiber_presence_flag,
  primary_market_id,
  is_seam_county,
  formula_version,
  input_data_version
FROM analytics.county_market_pressure_current;`,
  },
};

function getQuerySpec(name: QueryName): RegisteredQuerySpec {
  return QUERY_SPECS[name];
}

function getFacilitiesBboxQueryName(
  perspective: FacilityPerspective
): "facilities_bbox_colocation" | "facilities_bbox_hyperscale" {
  if (perspective === "hyperscale") {
    return "facilities_bbox_hyperscale";
  }

  return "facilities_bbox_colocation";
}

function getFacilitiesPolygonQueryName(
  perspective: FacilityPerspective
): "facilities_polygon_colocation" | "facilities_polygon_hyperscale" {
  if (perspective === "hyperscale") {
    return "facilities_polygon_hyperscale";
  }

  return "facilities_polygon_colocation";
}

function getFacilityDetailQueryName(
  perspective: FacilityPerspective
): "facility_detail_colocation" | "facility_detail_hyperscale" {
  if (perspective === "hyperscale") {
    return "facility_detail_hyperscale";
  }

  return "facility_detail_colocation";
}

export function getFacilitiesBboxQuerySpec(perspective: FacilityPerspective): SqlQuerySpec {
  return getQuerySpec(getFacilitiesBboxQueryName(perspective));
}

export function getFacilitiesPolygonQuerySpec(perspective: FacilityPerspective): SqlQuerySpec {
  return getQuerySpec(getFacilitiesPolygonQueryName(perspective));
}

export function getFacilityDetailQuerySpec(perspective: FacilityPerspective): SqlQuerySpec {
  return getQuerySpec(getFacilityDetailQueryName(perspective));
}

export function getCountyMetricsQuerySpec(): SqlQuerySpec {
  return getQuerySpec("county_metrics");
}

export function buildFacilitiesBboxQuery(query: FacilitiesBboxSqlQueryArgs): ParcelSqlQuery {
  const spec = getFacilitiesBboxQuerySpec(query.perspective);

  return {
    sql: spec.sql,
    params: [query.west, query.south, query.east, query.north, query.limit],
  };
}

export function buildFacilitiesPolygonQuery(query: FacilitiesPolygonSqlQueryArgs): ParcelSqlQuery {
  const spec = getFacilitiesPolygonQuerySpec(query.perspective);

  return {
    sql: spec.sql,
    params: [query.geometryGeoJson, query.limit],
  };
}

export function buildFacilityDetailQuery(query: FacilityDetailSqlQueryArgs): ParcelSqlQuery {
  const spec = getFacilityDetailQuerySpec(query.perspective);

  return {
    sql: spec.sql,
    params: [query.facilityId],
  };
}

const PARCELS_CANONICAL_TABLE = "parcel_current.parcels";

function parcelGeometryExpression(mode: ParcelGeometryModeSql): string {
  if (mode === "none") {
    return "NULL::jsonb";
  }

  if (mode === "centroid") {
    return "ST_AsGeoJSON(ST_PointOnSurface(p.geom))::jsonb";
  }

  if (mode === "simplified") {
    return "ST_AsGeoJSON(ST_SimplifyPreserveTopology(p.geom, 0.00002))::jsonb";
  }

  return "ST_AsGeoJSON(p.geom)::jsonb";
}

function buildParcelSelect(mode: ParcelGeometryModeSql): string {
  const geomExpression = parcelGeometryExpression(mode);

  return `
SELECT
  p.parcel_id::text AS parcel_id,
  p.source_oid,
  p.state2,
  p.geoid,
  p.source_updated_at,
  p.ingestion_run_id::text AS ingestion_run_id,
  p.attrs::jsonb AS attrs_json,
  ${geomExpression} AS geom_json
FROM ${PARCELS_CANONICAL_TABLE} AS p`;
}

function buildCursorFilter(
  cursor: string | null | undefined,
  nextParamIndex: number
): { readonly clause: string; readonly params: readonly (number | string)[] } {
  if (!cursor || cursor.trim().length === 0) {
    return {
      clause: "",
      params: [],
    };
  }

  return {
    clause: ` AND p.parcel_id::text > $${nextParamIndex}`,
    params: [cursor.trim()],
  };
}

export function buildParcelDetailQuery(
  parcelId: string,
  includeGeometry: ParcelGeometryModeSql
): ParcelSqlQuery {
  const sql = `${buildParcelSelect(includeGeometry)}\nWHERE p.parcel_id::text = $1\nLIMIT 1;`;

  return {
    sql,
    params: [parcelId],
  };
}

export function buildParcelLookupByIdsQuery(
  parcelIds: readonly string[],
  includeGeometry: ParcelGeometryModeSql
): ParcelSqlQuery {
  if (parcelIds.length === 0) {
    throw new Error("parcelIds must contain at least one id");
  }

  const placeholders = parcelIds.map((_, index) => `$${index + 1}`).join(", ");
  const sql = `${buildParcelSelect(includeGeometry)}\nWHERE p.parcel_id::text IN (${placeholders})\nORDER BY p.parcel_id::text ASC;`;

  return {
    sql,
    params: [...parcelIds],
  };
}

export function buildParcelsEnrichByBboxQuery(
  bbox: ParcelBboxFilter,
  options: ParcelEnrichQueryOptions
): ParcelSqlQuery {
  const baseParams: Array<number | string> = [bbox.west, bbox.south, bbox.east, bbox.north];
  const cursorFilter = buildCursorFilter(options.cursor, baseParams.length + 1);
  const params: Array<number | string> = [...baseParams, ...cursorFilter.params, options.limit];
  const limitParamIndex = params.length;

  const sql = `
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
)
${buildParcelSelect(options.includeGeometry)}
, bounds
WHERE p.geom_3857 && bounds.bbox_3857
  AND ST_Intersects(p.geom_3857, bounds.bbox_3857)${cursorFilter.clause}
ORDER BY p.parcel_id::text ASC
LIMIT $${limitParamIndex};`;

  return {
    sql,
    params,
  };
}

export function buildParcelsEnrichByPolygonQuery(
  geometryGeoJson: string,
  options: ParcelEnrichQueryOptions
): ParcelSqlQuery {
  const baseParams: Array<number | string> = [geometryGeoJson];
  const cursorFilter = buildCursorFilter(options.cursor, baseParams.length + 1);
  const params: Array<number | string> = [...baseParams, ...cursorFilter.params, options.limit];
  const limitParamIndex = params.length;

  const sql = `
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
)
${buildParcelSelect(options.includeGeometry)}
, aoi
WHERE p.geom_3857 && aoi.geom_3857
  AND ST_Intersects(p.geom_3857, aoi.geom_3857)${cursorFilter.clause}
ORDER BY p.parcel_id::text ASC
LIMIT $${limitParamIndex};`;

  return {
    sql,
    params,
  };
}

export function buildParcelsEnrichByCountyQuery(
  geoid: string,
  options: ParcelEnrichQueryOptions
): ParcelSqlQuery {
  const baseParams: Array<number | string> = [geoid.trim()];
  const cursorFilter = buildCursorFilter(options.cursor, baseParams.length + 1);
  const params: Array<number | string> = [...baseParams, ...cursorFilter.params, options.limit];
  const limitParamIndex = params.length;

  const sql = `${buildParcelSelect(options.includeGeometry)}
WHERE p.geoid = $1${cursorFilter.clause}
ORDER BY p.parcel_id::text ASC
LIMIT $${limitParamIndex};`;

  return {
    sql,
    params,
  };
}
