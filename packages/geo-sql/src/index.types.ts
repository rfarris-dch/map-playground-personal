export interface ParcelEnrichQueryOptions {
  readonly cursor?: string | null;
  readonly includeGeometry: ParcelGeometryModeSql;
  readonly limit: number;
}

export interface ParcelSqlQuery {
  readonly params: readonly (number | string)[];
  readonly sql: string;
}

export interface ParcelBboxFilter {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

export type ParcelGeometryModeSql = "none" | "centroid" | "simplified" | "full";

export interface QuerySpec {
  endpointClass: "feature-collection" | "administrative-aggregation" | "proximity-enrichment";
  maxRows: number;
  name: QueryName;
  sql: string;
}

export type QueryName =
  | "facilities_bbox_colocation"
  | "facilities_bbox_hyperscale"
  | "facilities_polygon_colocation"
  | "facilities_polygon_hyperscale"
  | "facility_detail_colocation"
  | "facility_detail_hyperscale"
  | "county_metrics";
