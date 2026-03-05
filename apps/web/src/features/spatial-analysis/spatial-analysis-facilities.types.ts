import type {
  CommissionedSemantic,
  FacilityPerspective,
  LeaseOrOwn,
} from "@map-migration/contracts";
import type { LngLat } from "@map-migration/map-engine";

export interface SpatialAnalysisFacilityRecord {
  readonly commissionedPowerMw: number | null;
  readonly commissionedSemantic: CommissionedSemantic;
  readonly coordinates: LngLat;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly perspective: FacilityPerspective;
  readonly providerName: string;
}
