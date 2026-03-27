import type {
  CommissionedSemantic,
  LeaseOrOwn,
} from "@map-migration/geo-kernel/commissioned-semantic";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilityClusterSummary } from "@/features/facilities/facilities-cluster.types";

export interface FacilityHoverState {
  readonly address: string | null;
  readonly availablePowerMw: number | null;
  readonly city: string | null;
  readonly commissionedPowerMw: number | null;
  readonly commissionedSemantic: CommissionedSemantic;
  readonly coordinates: readonly [number, number] | null;
  readonly facilityCode: string | null;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly marketName: string | null;
  readonly perspective: FacilityPerspective;
  readonly plannedPowerMw: number | null;
  readonly providerId: string;
  readonly providerName: string;
  readonly screenPoint: readonly [number, number];
  readonly stateAbbrev: string | null;
  readonly statusLabel: string | null;
  readonly underConstructionPowerMw: number | null;
}

export interface ClusterProviderSummary {
  readonly name: string;
  readonly totalPowerMw: number;
}

export interface ClusterFacilityRow {
  readonly commissionedPowerMw: number;
  readonly facilityName: string;
  readonly plannedPowerMw: number;
  readonly providerName: string;
  readonly statusLabel: string | null;
  readonly underConstructionPowerMw: number;
}

export interface FacilityClusterHoverState extends FacilityClusterSummary {
  readonly facilities: readonly ClusterFacilityRow[];
  readonly providerCount: number;
  readonly screenPoint: readonly [number, number];
  readonly topProviders: readonly ClusterProviderSummary[];
}

export interface FacilitiesHoverOptions {
  readonly isInteractionEnabled?: () => boolean;
  readonly onClusterHoverChange?: (nextHover: FacilityClusterHoverState | null) => void;
  readonly onHoverChange?: (nextHover: FacilityHoverState | null) => void;
  readonly perspectives: readonly FacilityPerspective[];
  readonly resolveFeatureProperties?: (featureId: number | string) => unknown | null;
}

export interface FacilitiesHoverController {
  clear(): void;
  destroy(): void;
}
