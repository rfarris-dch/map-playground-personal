import type { FacilityPerspective } from "@map-migration/contracts";

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

export interface FacilityClusterMarkerModel extends FacilityClusterSummary {
  readonly sizePx: number;
}

export interface FacilityClusterMarkerUpdate extends FacilityClusterMarkerModel {
  readonly signature: string;
}

export interface FacilityClusterPowerSegment {
  readonly color: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: number;
}

export interface FacilityClusterMarkerReconciliation {
  readonly additions: readonly FacilityClusterMarkerUpdate[];
  readonly moves: readonly FacilityClusterMarkerUpdate[];
  readonly removals: readonly number[];
  readonly replacements: readonly FacilityClusterMarkerUpdate[];
}
