import type {
  CommissionedSemantic,
  LeaseOrOwn,
} from "@map-migration/geo-kernel/commissioned-semantic";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilityClusterSummary } from "@/features/facilities/facilities-cluster.types";

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

export interface ClusterFacilityRow {
  readonly facilityName: string;
  readonly providerName: string;
  readonly commissionedPowerMw: number;
  readonly underConstructionPowerMw: number;
  readonly plannedPowerMw: number;
  readonly statusLabel: string | null;
}

export interface FacilityClusterHoverState extends FacilityClusterSummary {
  readonly facilities: readonly ClusterFacilityRow[];
  readonly screenPoint: readonly [number, number];
  readonly topProviders: readonly ClusterProviderSummary[];
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
