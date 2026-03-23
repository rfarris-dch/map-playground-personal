import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { ParcelGeometryMode } from "@map-migration/http-contracts/parcels-http";

export interface ParcelEnrichQueryOptions {
  readonly cursor?: string | null;
  readonly includeGeometry: ParcelGeometryModeSql;
  readonly limit: number;
}

export type SqlParamValue = number | string | readonly string[];

export interface ParcelSqlQuery {
  readonly params: readonly SqlParamValue[];
  readonly sql: string;
}

export interface SqlQuerySpec {
  readonly endpointClass: "feature-collection" | "boundary-aggregation" | "proximity-enrichment";
  readonly maxRows: number;
  readonly sql: string;
}

export interface FacilitiesDatasetSqlTables {
  readonly colocationFastTable: string;
  readonly hyperscaleFastTable: string;
}

export interface FacilitiesBboxSqlQueryArgs extends BBox {
  readonly limit: number;
  readonly perspective: FacilityPerspective;
  readonly tables?: FacilitiesDatasetSqlTables;
}

export interface FacilitiesPolygonSqlQueryArgs {
  readonly geometryGeoJson: string;
  readonly limit: number;
  readonly perspective: FacilityPerspective;
  readonly tables?: FacilitiesDatasetSqlTables;
}

export interface FacilityDetailSqlQueryArgs {
  readonly facilityId: string;
  readonly perspective: FacilityPerspective;
  readonly tables?: FacilitiesDatasetSqlTables;
}

export type ParcelBboxFilter = BBox;

export type ParcelGeometryModeSql = ParcelGeometryMode;
