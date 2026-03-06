import type { FacilityPerspective } from "@map-migration/contracts";
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
)
SELECT
  s.facility_id,
  s.facility_name,
  s.provider_id,
  COALESCE(NULLIF(BTRIM(p."NAME"), ''), s.provider_id::text) AS provider_name,
  s.county_fips,
  s.commissioned_power_mw,
  s.commissioned_semantic,
  NULL::text AS lease_or_own,
  ST_AsGeoJSON(s.geom)::jsonb AS geom_json
FROM serve.facility_site AS s
LEFT JOIN mirror."HAWK_PROVIDER_PROFILE" AS p
  ON p."PROVIDER_PROFILE_ID"::text = s.provider_id::text
, bounds
WHERE s.geom_3857 && bounds.bbox_3857
  AND ST_Intersects(s.geom_3857, bounds.bbox_3857)
  AND s.provider_id IS NOT NULL
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
  s.hyperscale_id AS facility_id,
  s.facility_name,
  s.provider_id,
  COALESCE(NULLIF(BTRIM(p."NAME"), ''), s.provider_id::text) AS provider_name,
  s.county_fips,
  s.commissioned_power_mw,
  s.commissioned_semantic,
  s.lease_or_own,
  ST_AsGeoJSON(s.geom)::jsonb AS geom_json
FROM serve.hyperscale_site AS s
LEFT JOIN mirror."HAWK_PROVIDER_PROFILE" AS p
  ON p."PROVIDER_PROFILE_ID"::text = s.provider_id::text
, bounds
WHERE s.geom_3857 && bounds.bbox_3857
  AND ST_Intersects(s.geom_3857, bounds.bbox_3857)
  AND s.provider_id IS NOT NULL
LIMIT $5;`,
  },
  facilities_polygon_colocation: {
    name: "facilities_polygon_colocation",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
)
SELECT
  f.facility_id,
  f.facility_name,
  f.provider_id,
  COALESCE(NULLIF(BTRIM(p."NAME"), ''), f.provider_id::text) AS provider_name,
  f.county_fips,
  f.commissioned_power_mw,
  f.commissioned_semantic,
  NULL::text AS lease_or_own,
  ST_AsGeoJSON(f.geom)::jsonb AS geom_json
FROM serve.facility_site AS f
LEFT JOIN mirror."HAWK_PROVIDER_PROFILE" AS p
  ON p."PROVIDER_PROFILE_ID"::text = f.provider_id::text
, aoi
WHERE f.geom_3857 && aoi.geom_3857
  AND ST_Intersects(f.geom_3857, aoi.geom_3857)
  AND f.provider_id IS NOT NULL
LIMIT $2;`,
  },
  facilities_polygon_hyperscale: {
    name: "facilities_polygon_hyperscale",
    endpointClass: "feature-collection",
    maxRows: 5000,
    sql: `
WITH aoi AS (
  SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857) AS geom_3857
)
SELECT
  h.hyperscale_id AS facility_id,
  h.facility_name,
  h.provider_id,
  COALESCE(NULLIF(BTRIM(p."NAME"), ''), h.provider_id::text) AS provider_name,
  h.county_fips,
  h.commissioned_power_mw,
  h.commissioned_semantic,
  h.lease_or_own,
  ST_AsGeoJSON(h.geom)::jsonb AS geom_json
FROM serve.hyperscale_site AS h
LEFT JOIN mirror."HAWK_PROVIDER_PROFILE" AS p
  ON p."PROVIDER_PROFILE_ID"::text = h.provider_id::text
, aoi
WHERE h.geom_3857 && aoi.geom_3857
  AND ST_Intersects(h.geom_3857, aoi.geom_3857)
  AND h.provider_id IS NOT NULL
LIMIT $2;`,
  },
  facility_detail_colocation: {
    name: "facility_detail_colocation",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  s.facility_id,
  s.facility_name,
  s.provider_id,
  COALESCE(NULLIF(BTRIM(p."NAME"), ''), s.provider_id::text) AS provider_name,
  s.county_fips,
  s.commissioned_power_mw,
  s.planned_power_mw,
  s.under_construction_power_mw,
  s.available_power_mw,
  s.commissioned_semantic,
  NULL::text AS lease_or_own,
  ST_AsGeoJSON(s.geom)::jsonb AS geom_json
FROM serve.facility_site AS s
LEFT JOIN mirror."HAWK_PROVIDER_PROFILE" AS p
  ON p."PROVIDER_PROFILE_ID"::text = s.provider_id::text
WHERE s.facility_id = $1
  AND s.provider_id IS NOT NULL
LIMIT 1;`,
  },
  facility_detail_hyperscale: {
    name: "facility_detail_hyperscale",
    endpointClass: "proximity-enrichment",
    maxRows: 1,
    sql: `
SELECT
  s.hyperscale_id AS facility_id,
  s.facility_name,
  s.provider_id,
  COALESCE(NULLIF(BTRIM(p."NAME"), ''), s.provider_id::text) AS provider_name,
  s.county_fips,
  s.commissioned_power_mw,
  s.planned_power_mw,
  s.under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  s.commissioned_semantic,
  s.lease_or_own,
  ST_AsGeoJSON(s.geom)::jsonb AS geom_json
FROM serve.hyperscale_site AS s
LEFT JOIN mirror."HAWK_PROVIDER_PROFILE" AS p
  ON p."PROVIDER_PROFILE_ID"::text = s.provider_id::text
WHERE s.hyperscale_id = $1
  AND s.provider_id IS NOT NULL
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
