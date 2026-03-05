export type QueryName =
  | "facilities_bbox_colocation"
  | "facilities_bbox_hyperscale"
  | "facility_detail_colocation"
  | "facility_detail_hyperscale"
  | "county_metrics";

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
};

export function getQuerySpec(name: QueryName): QuerySpec {
  return QUERY_SPECS[name];
}

export type ParcelGeometryModeSql = "none" | "centroid" | "simplified" | "full";

export interface ParcelBboxFilter {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

export interface ParcelSqlQuery {
  readonly params: readonly (number | string)[];
  readonly sql: string;
}

export interface ParcelEnrichQueryOptions {
  readonly cursor?: string | null;
  readonly includeGeometry: ParcelGeometryModeSql;
  readonly limit: number;
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
