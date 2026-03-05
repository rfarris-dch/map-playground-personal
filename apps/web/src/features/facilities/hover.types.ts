import type {
  CommissionedSemantic,
  FacilityPerspective,
  LeaseOrOwn,
} from "@map-migration/contracts";

export interface FacilityHoverState {
  readonly commissionedPowerMw: number | null;
  readonly commissionedSemantic: CommissionedSemantic;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly perspective: FacilityPerspective;
  readonly providerId: string;
  readonly providerName: string;
  readonly screenPoint: readonly [number, number];
}

export interface FacilitiesHoverOptions {
  readonly isInteractionEnabled?: () => boolean;
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
