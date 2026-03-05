import type {
  FacilitiesDetailResponse,
  FacilitiesFeatureCollection,
  FacilitiesTableResponse,
  FacilityPerspective,
  FacilitySortBy,
  SortDirection,
  Warning,
} from "@map-migration/contracts";
import type {
  FacilitiesBboxRow,
  FacilityDetailRow,
  FacilityTableRow,
} from "@/geo/facilities/facilities.repo";

export type QueryFacilityDetailRowResult =
  | { readonly ok: true; readonly value: FacilityDetailRow | null }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

export type QueryFacilitiesTableRowsResult =
  | {
      readonly ok: true;
      readonly value: { readonly rows: readonly FacilityTableRow[]; readonly totalCount: number };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

export type QueryFacilitiesRowsResult =
  | { readonly ok: true; readonly value: readonly FacilitiesBboxRow[] }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

export type QueryFacilityDetailResult =
  | { readonly ok: true; readonly value: { readonly feature: FacilitiesDetailResponse["feature"] } }
  | {
      readonly ok: false;
      readonly value: {
        readonly error?: unknown;
        readonly reason: "mapping_failed" | "not_found" | "query_failed";
      };
    };

export interface QueryFacilityDetailArgs {
  readonly facilityId: string;
  readonly perspective: FacilityPerspective;
}

export type QueryFacilitiesTableResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly rows: FacilitiesTableResponse["rows"];
        readonly totalCount: number;
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

export interface QueryFacilitiesTableArgs {
  readonly limit: number;
  readonly offset: number;
  readonly perspective: FacilityPerspective;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

export type QueryFacilitiesByPolygonResult = QueryFacilitiesByBboxResult;

export type QueryFacilitiesByBboxResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly features: FacilitiesFeatureCollection["features"];
        readonly truncated: boolean;
        readonly warnings: readonly Warning[];
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

export interface QueryFacilitiesByPolygonArgs {
  readonly geometryGeoJson: string;
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}

export interface QueryFacilitiesByBboxArgs {
  readonly bbox: {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
  };
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}
