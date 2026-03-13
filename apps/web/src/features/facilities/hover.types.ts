import type {
  CommissionedSemantic,
  FacilityPerspective,
  LeaseOrOwn,
} from "@map-migration/contracts";

export interface FacilityHoverState {
  readonly availablePowerMw: number | null;
  readonly commissionedPowerMw: number | null;
  readonly commissionedSemantic: CommissionedSemantic;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly perspective: FacilityPerspective;
  readonly plannedPowerMw: number | null;
  readonly providerId: string;
  readonly providerName: string;
  readonly screenPoint: readonly [number, number];
  readonly statusLabel: string | null;
  readonly underConstructionPowerMw: number | null;
}

export interface ClusterProviderSummary {
  readonly name: string;
  readonly totalPowerMw: number;
}

export interface FacilityClusterHoverState {
  readonly center: readonly [number, number];
  readonly clusterId: number;
  readonly commissionedPowerMw: number;
  readonly facilityCount: number;
  readonly perspective: FacilityPerspective;
  readonly plannedPowerMw: number;
  readonly screenPoint: readonly [number, number];
  readonly topProviders: readonly ClusterProviderSummary[];
  readonly totalPowerMw: number;
  readonly underConstructionPowerMw: number;
}

export interface FacilitiesHoverOptions {
  readonly isInteractionEnabled?: () => boolean;
  readonly onClusterHoverChange?: (nextHover: FacilityClusterHoverState | null) => void;
  readonly onHoverChange?: (nextHover: FacilityHoverState | null) => void;
  readonly perspectives: readonly FacilityPerspective[];
}

export interface FacilitiesHoverController {
  clear(): void;
  destroy(): void;
}

export interface HoverTarget {
  readonly featureId: number | string;
  readonly sourceId: string;
}
