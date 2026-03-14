import type { AreaOfInterest } from "@map-migration/geo-kernel/area-of-interest";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  ParcelDetailResponse,
  ParcelGeometryMode,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";

export interface QueryParcelDetailArgs {
  readonly includeGeometry: ParcelGeometryMode;
  readonly parcelId: string;
}

export type QueryParcelDetailResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly feature: ParcelDetailResponse["feature"];
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "not_found" | "query_failed";
      };
    };

export interface LookupParcelFeaturesArgs {
  readonly includeGeometry: ParcelGeometryMode;
  readonly parcelIds: readonly string[];
}

export interface QueryParcelFeaturesByAoiArgs {
  readonly aoi: AreaOfInterest;
  readonly cursor: string | null;
  readonly includeGeometry: ParcelGeometryMode;
  readonly queryLimit: number;
}

export type QueryParcelFeaturesResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly features: ParcelsFeatureCollection["features"];
        readonly warnings: readonly Warning[];
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly message: string;
        readonly reason: "mapping_failed" | "policy_rejected" | "query_failed";
      };
    };
