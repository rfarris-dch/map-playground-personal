import type { FacilityPerspective } from "@map-migration/geo-kernel";

export interface SpatialAnalysisFacilityComparable {
  readonly commissionedPowerMw: number | null;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly perspective: FacilityPerspective;
}
