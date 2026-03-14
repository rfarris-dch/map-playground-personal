import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  FacilitiesFeatureCollection,
  FacilitiesSelectionRequest,
} from "@map-migration/http-contracts/facilities-http";

export interface QueryFacilitiesSelectionArgs {
  readonly geometry: FacilitiesSelectionRequest["geometry"];
  readonly limitPerPerspective: number;
  readonly perspectives: readonly FacilityPerspective[];
}

export type QueryFacilitiesSelectionResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly countsByPerspective: Record<FacilityPerspective, number>;
        readonly features: FacilitiesFeatureCollection["features"];
        readonly truncatedByPerspective: Record<FacilityPerspective, boolean>;
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
