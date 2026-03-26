import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  FacilitiesBboxSqlQueryArgs,
  FacilitiesDatasetSqlTables,
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
  FacilitiesDatasetSqlTables,
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
  | "facilities_bbox_hyperscale_leased"
  | "facilities_bbox_enterprise"
  | "facilities_polygon_colocation"
  | "facilities_polygon_hyperscale"
  | "facility_detail_colocation"
  | "facility_detail_hyperscale"
  | "county_metrics";

type RegisteredQuerySpec = SqlQuerySpec & {
  readonly name: QueryName;
};

const COLOCATION_FAST_TABLE_PLACEHOLDER = "__COLOCATION_FAST_TABLE__";
const HYPERSCALE_FAST_TABLE_PLACEHOLDER = "__HYPERSCALE_FAST_TABLE__";
const DEFAULT_FACILITIES_DATASET_SQL_TABLES: FacilitiesDatasetSqlTables = {
  colocationFastTable: "serve.facility_site_fast",
  hyperscaleFastTable: "serve.hyperscale_site_fast",
};

const QUERY_SPECS: Record<QueryName, RegisteredQuerySpec> = {
  facilities_bbox_colocation: {
    name: "facilities_bbox_colocation",
    endpointClass: "feature-collection",
    maxRows: 50_000,
    sql: `
/* facilities:bbox:colocation */
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
),
candidates AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_name,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    facility.commissioned_semantic,
    facility.lease_or_own,
    facility.status_label,
    facility.facility_code,
    facility.city,
    facility.market_name,
    facility.longitude,
    facility.latitude,
    facility.geom_3857
  FROM ${COLOCATION_FAST_TABLE_PLACEHOLDER} AS facility, bounds
  WHERE facility.geom_3857 && bounds.bbox_3857
    AND ST_Intersects(facility.geom_3857, bounds.bbox_3857)
    AND facility.provider_id IS NOT NULL
  ORDER BY
    facility.display_rank ASC,
    facility.facility_id ASC
  LIMIT $5
)
SELECT
  c.facility_id,
  c.facility_name,
  c.provider_id,
  c.provider_name,
  c.state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  c.available_power_mw,
  c.commissioned_semantic,
  c.lease_or_own,
  c.status_label,
  c.facility_code,
  c.city,
  c.market_name,
  c.longitude,
  c.latitude
FROM candidates AS c;`,
  },
  facilities_bbox_hyperscale: {
    name: "facilities_bbox_hyperscale",
    endpointClass: "feature-collection",
    maxRows: 50_000,
    sql: `
/* facilities:bbox:hyperscale */
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
),
candidates AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_name,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.commissioned_semantic,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    facility.lease_or_own,
    facility.status_label,
    facility.facility_code,
    facility.city,
    facility.market_name,
    facility.longitude,
    facility.latitude,
    facility.geom_3857
  FROM ${HYPERSCALE_FAST_TABLE_PLACEHOLDER} AS facility, bounds
  WHERE facility.geom_3857 && bounds.bbox_3857
    AND ST_Intersects(facility.geom_3857, bounds.bbox_3857)
    AND facility.provider_id IS NOT NULL
  ORDER BY
    facility.display_rank ASC,
    facility.facility_id ASC
  LIMIT $5
)
SELECT
  c.facility_id,
  c.facility_name,
  c.provider_id,
  c.provider_name,
  c.state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  c.available_power_mw,
  c.commissioned_semantic,
  c.lease_or_own,
  c.status_label,
  c.facility_code,
  c.city,
  c.market_name,
  c.longitude,
  c.latitude
FROM candidates AS c;`,
  },
  facilities_bbox_hyperscale_leased: {
    name: "facilities_bbox_hyperscale_leased",
    endpointClass: "feature-collection",
    maxRows: 50_000,
    sql: `
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
),
lease_entries AS (
  SELECT
    lt.id AS lease_id,
    lt.company_name,
    lt.market_name,
    lt.lease_mw,
    mb.geom AS market_geom,
    mkt.market_id,
    ST_GeneratePoints(mb.geom, 1) AS seed_point
  FROM serve.hyperscale_lease_total lt
  CROSS JOIN bounds
  JOIN market_current.markets mkt ON mkt.name = lt.market_name
  JOIN market_current.market_boundaries mb ON mb.market_id = mkt.market_id
  WHERE ST_Transform(mb.geom, 3857) && bounds.bbox_3857
    AND lt.lease_mw > 0
),
positioned AS (
  SELECT
    le.*,
    (ST_Dump(le.seed_point)).geom AS pt
  FROM lease_entries le
),
market_groups AS (
  SELECT
    market_id,
    market_geom,
    ST_Collect(pt) AS points
  FROM positioned
  GROUP BY market_id, market_geom
),
voronoi_raw AS (
  SELECT
    mg.market_id,
    mg.market_geom,
    (ST_Dump(ST_VoronoiPolygons(mg.points, 0, mg.market_geom))).geom AS cell_geom
  FROM market_groups mg
  WHERE ST_NumGeometries(mg.points) > 1
),
clipped AS (
  SELECT
    p.lease_id,
    p.company_name,
    p.market_name,
    p.lease_mw,
    p.market_id,
    ST_Intersection(v.cell_geom, v.market_geom) AS voronoi_geom
  FROM voronoi_raw v
  JOIN positioned p ON ST_Contains(v.cell_geom, p.pt) AND p.market_id = v.market_id

  UNION ALL

  SELECT
    p.lease_id,
    p.company_name,
    p.market_name,
    p.lease_mw,
    p.market_id,
    p.market_geom AS voronoi_geom
  FROM positioned p
  WHERE p.market_id IN (
    SELECT mg.market_id FROM market_groups mg WHERE ST_NumGeometries(mg.points) = 1
  )
)
SELECT
  'lease-' || c.lease_id::text AS facility_id,
  c.company_name AS facility_name,
  c.company_name AS provider_id,
  c.company_name AS provider_name,
  ''::text AS county_fips,
  NULL::text AS state_abbrev,
  c.lease_mw AS commissioned_power_mw,
  NULL::numeric AS planned_power_mw,
  NULL::numeric AS under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  NULL::numeric AS square_footage,
  'leased'::text AS commissioned_semantic,
  'lease'::text AS lease_or_own,
  NULL::text AS status_label,
  NULL::text AS facility_code,
  NULL::text AS address,
  NULL::text AS city,
  NULL::text AS state,
  c.market_name,
  ST_AsGeoJSON(c.voronoi_geom)::jsonb AS geom_json
FROM clipped AS c;`,
  },
  facilities_bbox_enterprise: {
    name: "facilities_bbox_enterprise",
    endpointClass: "feature-collection",
    maxRows: 50_000,
    sql: `
/* facilities:bbox:enterprise */
WITH bounds AS (
  SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857) AS bbox_3857
)
SELECT
  facility.enterprise_site_id AS facility_id,
  COALESCE(NULLIF(BTRIM(facility.company), ''), facility.enterprise_name) AS facility_name,
  NULLIF(BTRIM(facility.company), '') AS provider_id,
  COALESCE(NULLIF(BTRIM(facility.company), ''), facility.enterprise_name) AS provider_name,
  COALESCE(facility.county_fips, ''::text) AS county_fips,
  NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
  NULL::numeric AS commissioned_power_mw,
  NULL::numeric AS planned_power_mw,
  NULL::numeric AS under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  facility.facility_sf::numeric AS square_footage,
  NULL::text AS commissioned_semantic,
  NULL::text AS lease_or_own,
  NULL::text AS status_label,
  NULL::text AS facility_code,
  NULLIF(BTRIM(facility.address), '') AS address,
  NULLIF(BTRIM(facility.city), '') AS city,
  facility.state_abbrev AS state,
  NULL::text AS market_name,
  ST_AsGeoJSON(facility.geom)::jsonb AS geom_json
FROM serve.enterprise_site AS facility, bounds
WHERE facility.geom_3857 && bounds.bbox_3857
  AND ST_Intersects(facility.geom_3857, bounds.bbox_3857)
ORDER BY
  COALESCE(facility.facility_sf, 0) DESC,
  COALESCE(NULLIF(BTRIM(facility.company), ''), facility.enterprise_name) ASC NULLS LAST,
  facility.enterprise_site_id ASC
LIMIT $5;`,
  },
  facilities_polygon_colocation: {
    name: "facilities_polygon_colocation",
    endpointClass: "feature-collection",
    maxRows: 50_000,
    sql: `
/* facilities:polygon:colocation */
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
),
candidates AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_name,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    facility.commissioned_semantic,
    facility.lease_or_own,
    facility.status_label,
    facility.facility_code,
    facility.city,
    facility.market_name,
    facility.longitude,
    facility.latitude,
    facility.geom_3857
  FROM ${COLOCATION_FAST_TABLE_PLACEHOLDER} AS facility, aoi
  WHERE facility.geom_3857 && aoi.geom_3857
    AND ST_Intersects(facility.geom_3857, aoi.geom_3857)
    AND facility.provider_id IS NOT NULL
  ORDER BY
    facility.display_rank ASC,
    facility.facility_id ASC
  LIMIT $2
)
SELECT
  c.facility_id,
  c.facility_name,
  c.provider_id,
  c.provider_name,
  c.state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  c.available_power_mw,
  c.commissioned_semantic,
  c.lease_or_own,
  c.status_label,
  c.facility_code,
  c.city,
  c.market_name,
  c.longitude,
  c.latitude
FROM candidates AS c;`,
  },
  facilities_polygon_hyperscale: {
    name: "facilities_polygon_hyperscale",
    endpointClass: "feature-collection",
    maxRows: 50_000,
    sql: `
/* facilities:polygon:hyperscale */
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
),
candidates AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    facility.provider_name,
    facility.state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    facility.commissioned_semantic,
    facility.lease_or_own,
    facility.status_label,
    facility.facility_code,
    facility.city,
    facility.market_name,
    facility.longitude,
    facility.latitude,
    facility.geom_3857
  FROM ${HYPERSCALE_FAST_TABLE_PLACEHOLDER} AS facility, aoi
  WHERE facility.geom_3857 && aoi.geom_3857
    AND ST_Intersects(facility.geom_3857, aoi.geom_3857)
    AND facility.provider_id IS NOT NULL
  ORDER BY
    facility.display_rank ASC,
    facility.facility_id ASC
  LIMIT $2
)
SELECT
  c.facility_id,
  c.facility_name,
  c.provider_id,
  c.provider_name,
  c.state_abbrev,
  c.commissioned_power_mw,
  c.planned_power_mw,
  c.under_construction_power_mw,
  c.available_power_mw,
  c.commissioned_semantic,
  c.lease_or_own,
  c.status_label,
  c.facility_code,
  c.city,
  c.market_name,
  c.longitude,
  c.latitude
FROM candidates AS c;`,
  },
  facility_detail_colocation: {
    name: "facility_detail_colocation",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
/* facilities:detail:colocation */
SELECT
  facility.facility_id,
  facility.facility_name,
  facility.provider_id,
  facility.provider_name,
  facility.county_fips,
  facility.state_abbrev,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  facility.available_power_mw,
  facility.square_footage,
  facility.commissioned_semantic,
  facility.lease_or_own,
  facility.status_label,
  facility.facility_code,
  facility.address,
  facility.city,
  facility.state,
  facility.market_name,
  facility.longitude,
  facility.latitude
FROM ${COLOCATION_FAST_TABLE_PLACEHOLDER} AS facility
WHERE facility.facility_id = $1
  AND facility.provider_id IS NOT NULL
LIMIT 1;`,
  },
  facility_detail_hyperscale: {
    name: "facility_detail_hyperscale",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
/* facilities:detail:hyperscale */
SELECT
  facility.facility_id,
  facility.facility_name,
  facility.provider_id,
  facility.provider_name,
  facility.county_fips,
  facility.state_abbrev,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  facility.available_power_mw,
  facility.square_footage,
  facility.commissioned_semantic,
  facility.lease_or_own,
  facility.status_label,
  facility.facility_code,
  facility.address,
  facility.city,
  facility.state,
  facility.market_name,
  facility.longitude,
  facility.latitude
FROM ${HYPERSCALE_FAST_TABLE_PLACEHOLDER} AS facility
WHERE facility.facility_id = $1
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
  wholesale_operator,
  market_structure,
  balancing_authority,
  load_zone,
  operator_zone_label,
  operator_zone_type,
  operator_zone_confidence,
  weather_zone,
  operator_weather_zone,
  meteo_zone,
  retail_choice_status,
  competitive_area_type,
  transmission_miles_69kv_plus,
  transmission_miles_138kv_plus,
  transmission_miles_230kv_plus,
  transmission_miles_345kv_plus,
  transmission_miles_500kv_plus,
  transmission_miles_765kv_plus,
  gas_pipeline_presence_flag,
  gas_pipeline_mileage_county,
  fiber_presence_flag,
  primary_market_id,
  primary_tdu_or_utility,
  utility_context_json,
  is_border_county,
  is_seam_county,
  queue_storage_mw,
  queue_solar_mw,
  queue_wind_mw,
  queue_avg_age_days,
  queue_withdrawal_rate,
  recent_online_mw,
  avg_rt_congestion_component,
  p95_shadow_price,
  negative_price_hour_share,
  top_constraints_json,
  source_provenance_json,
  formula_version,
  input_data_version
FROM analytics.county_market_pressure_current;`,
  },
};

function getQuerySpec(name: QueryName): RegisteredQuerySpec {
  return QUERY_SPECS[name];
}

function materializeFacilitiesSql(
  sql: string,
  tables: FacilitiesDatasetSqlTables = DEFAULT_FACILITIES_DATASET_SQL_TABLES
): string {
  return sql
    .replaceAll(COLOCATION_FAST_TABLE_PLACEHOLDER, tables.colocationFastTable)
    .replaceAll(HYPERSCALE_FAST_TABLE_PLACEHOLDER, tables.hyperscaleFastTable);
}

function materializeFacilitiesQuerySpec(
  spec: RegisteredQuerySpec,
  tables?: FacilitiesDatasetSqlTables
): SqlQuerySpec {
  return {
    endpointClass: spec.endpointClass,
    maxRows: spec.maxRows,
    sql: materializeFacilitiesSql(spec.sql, tables),
  };
}

function getFacilitiesBboxQueryName(
  perspective: FacilityPerspective
):
  | "facilities_bbox_colocation"
  | "facilities_bbox_hyperscale"
  | "facilities_bbox_hyperscale_leased"
  | "facilities_bbox_enterprise" {
  if (perspective === "hyperscale") {
    return "facilities_bbox_hyperscale";
  }
  if (perspective === "hyperscale-leased") {
    return "facilities_bbox_hyperscale_leased";
  }
  if (perspective === "enterprise") {
    return "facilities_bbox_enterprise";
  }

  return "facilities_bbox_colocation";
}

function getFacilitiesPolygonQueryName(
  perspective: FacilityPerspective
): "facilities_polygon_colocation" | "facilities_polygon_hyperscale" {
  if (perspective === "hyperscale" || perspective === "hyperscale-leased") {
    return "facilities_polygon_hyperscale";
  }

  if (perspective === "enterprise") {
    throw new Error(
      `Unsupported facility perspective for polygon query: "${perspective}". Enterprise only supports bbox queries.`
    );
  }

  return "facilities_polygon_colocation";
}

function getFacilityDetailQueryName(
  perspective: FacilityPerspective
): "facility_detail_colocation" | "facility_detail_hyperscale" {
  if (perspective === "hyperscale" || perspective === "hyperscale-leased") {
    return "facility_detail_hyperscale";
  }

  if (perspective === "enterprise") {
    throw new Error(
      `Unsupported facility perspective for detail query: "${perspective}". Enterprise only supports bbox queries.`
    );
  }

  return "facility_detail_colocation";
}

export function getFacilitiesBboxQuerySpec(perspective: FacilityPerspective): SqlQuerySpec {
  return materializeFacilitiesQuerySpec(getQuerySpec(getFacilitiesBboxQueryName(perspective)));
}

export function getFacilitiesPolygonQuerySpec(perspective: FacilityPerspective): SqlQuerySpec {
  return materializeFacilitiesQuerySpec(getQuerySpec(getFacilitiesPolygonQueryName(perspective)));
}

export function getFacilityDetailQuerySpec(perspective: FacilityPerspective): SqlQuerySpec {
  return materializeFacilitiesQuerySpec(getQuerySpec(getFacilityDetailQueryName(perspective)));
}

export function getCountyMetricsQuerySpec(): SqlQuerySpec {
  return getQuerySpec("county_metrics");
}

export function buildFacilitiesBboxQuery(query: FacilitiesBboxSqlQueryArgs): ParcelSqlQuery {
  const spec = materializeFacilitiesQuerySpec(
    getQuerySpec(getFacilitiesBboxQueryName(query.perspective)),
    query.tables
  );

  return {
    sql: spec.sql,
    params: [query.west, query.south, query.east, query.north, query.limit],
  };
}

export function buildFacilitiesPolygonQuery(query: FacilitiesPolygonSqlQueryArgs): ParcelSqlQuery {
  const spec = materializeFacilitiesQuerySpec(
    getQuerySpec(getFacilitiesPolygonQueryName(query.perspective)),
    query.tables
  );

  return {
    sql: spec.sql,
    params: [query.geometryGeoJson, query.limit],
  };
}

export function buildFacilityDetailQuery(query: FacilityDetailSqlQueryArgs): ParcelSqlQuery {
  const spec = materializeFacilitiesQuerySpec(
    getQuerySpec(getFacilityDetailQueryName(query.perspective)),
    query.tables
  );

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

  const sql = `${buildParcelSelect(includeGeometry)}\nWHERE p.parcel_id::text = ANY($1::text[])\nORDER BY p.parcel_id::text ASC;`;

  return {
    sql,
    params: [[...parcelIds]],
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
