import type { CommissionedSemantic, FacilityPerspective, LeaseOrOwn } from "@map-migration/geo-kernel";
import type { LngLat } from "@map-migration/map-engine";

export interface SpatialAnalysisFacilityRecord {
  readonly address: string | null;
  readonly availablePowerMw: number | null;
  readonly city: string | null;
  readonly commissionedPowerMw: number | null;
  readonly commissionedSemantic: CommissionedSemantic;
  readonly coordinates: LngLat;
  readonly countyFips: string | null;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly perspective: FacilityPerspective;
  readonly plannedPowerMw: number | null;
  readonly providerId: string;
  readonly providerName: string;
  readonly squareFootage: number | null;
  readonly state: string | null;
  readonly stateAbbrev: string | null;
  readonly statusLabel: string | null;
  readonly underConstructionPowerMw: number | null;
}
