import type { z } from "zod";
import type { ParcelGeometryMode, ParcelProfile } from "@/parcels-contracts";
import type { BBox, FacilityPerspective, SourceMode } from "@/shared-contracts";
import type { SortDirection } from "@/table-contracts";
import type { HealthSchema } from "./api-contracts";

export interface DataVersionResolveOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fallback?: string;
  readonly override?: string | undefined;
}

export interface SortedPaginatedRouteArgs<TSortBy extends string> extends PaginatedRouteArgs {
  readonly sortBy: TSortBy;
  readonly sortOrder: SortDirection;
}

export interface PaginatedRouteArgs {
  readonly page: number;
  readonly pageSize: number;
}

export interface FacilitiesBboxRouteArgs {
  readonly bbox: BBox;
  readonly limit?: number | undefined;
  readonly perspective?: FacilityPerspective | undefined;
}

export interface FacilityDetailRouteOptions {
  readonly perspective?: FacilityPerspective | undefined;
}

export interface ParcelDetailRouteOptions {
  readonly includeGeometry?: ParcelGeometryMode | undefined;
  readonly profile?: ParcelProfile | undefined;
}

export interface ApiRoutesTable {
  readonly boundariesPower: string;
  readonly facilities: string;
  readonly facilitiesSelection: string;
  readonly facilitiesTable: string;
  readonly fiberLocatorLayers: string;
  readonly fiberLocatorLayersInView: string;
  readonly fiberLocatorTile: string;
  readonly fiberLocatorVectorTile: string;
  readonly health: string;
  readonly markets: string;
  readonly parcels: string;
  readonly parcelsSyncStatus: string;
  readonly providers: string;
}

export interface ApiHeadersTable {
  readonly parcelIngestionRunId: string;
  readonly requestId: string;
}

export interface ApiDefaultsTable {
  readonly boundariesSourceMode: SourceMode;
  readonly dataVersion: string;
  readonly facilitiesSourceMode: SourceMode;
  readonly fiberLocatorSourceMode: SourceMode;
  readonly parcelsSourceMode: SourceMode;
}

export interface ApiQueryDefaultsTable {
  readonly facilities: {
    readonly bboxLimit: number;
    readonly perspective: FacilityPerspective;
  };
  readonly parcelDetail: {
    readonly includeGeometry: ParcelGeometryMode;
    readonly profile: ParcelProfile;
  };
}

export type HealthResponse = z.infer<typeof HealthSchema>;
