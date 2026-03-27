import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";

export interface FacilityClusterSummary {
  readonly availablePowerMw: number;
  readonly center: readonly [number, number];
  readonly clusterId: number;
  readonly commissionedPowerMw: number;
  readonly facilityCount: number;
  readonly perspective: FacilityPerspective;
  readonly plannedPowerMw: number;
  readonly totalPowerMw: number;
  readonly underConstructionPowerMw: number;
}

export interface FacilityClusterPowerSegment {
  readonly color: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: number;
}
