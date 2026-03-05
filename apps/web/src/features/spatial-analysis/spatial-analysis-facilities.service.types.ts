import type { FacilityPerspective } from "@map-migration/contracts";

export interface SpatialAnalysisFacilityComparable {
  readonly commissionedPowerMw: number | null;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly perspective: FacilityPerspective;
}
