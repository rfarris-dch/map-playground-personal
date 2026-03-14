import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { ParcelGeometryMode } from "@map-migration/http-contracts/parcels-http";

export interface ParcelEnrichQueryOptions {
  readonly cursor?: string | null;
  readonly includeGeometry: ParcelGeometryModeSql;
  readonly limit: number;
}

export interface ParcelSqlQuery {
  readonly params: readonly (number | string)[];
  readonly sql: string;
}

export interface SqlQuerySpec {
  readonly endpointClass: "feature-collection" | "boundary-aggregation" | "proximity-enrichment";
  readonly maxRows: number;
  readonly sql: string;
}

export interface FacilitiesBboxSqlQueryArgs extends BBox {
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}

export interface FacilitiesPolygonSqlQueryArgs {
  readonly geometryGeoJson: string;
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}

export interface FacilityDetailSqlQueryArgs {
  readonly facilityId: string;
  readonly perspective: FacilityPerspective;
}

export type ParcelBboxFilter = BBox;

export type ParcelGeometryModeSql = ParcelGeometryMode;
