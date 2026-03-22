import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { IMap } from "@map-migration/map-engine";
import type { ScannerFacility } from "@/features/scanner/scanner.types";

export interface QuickViewCard {
  readonly address: string | null;
  readonly availablePowerMw: number | null;
  readonly city: string | null;
  readonly commissionedPowerMw: number | null;
  readonly facilityName: string;
  readonly id: string;
  readonly perspective: FacilityPerspective;
  readonly plannedPowerMw: number | null;
  readonly providerName: string;
  readonly screenX: number;
  readonly screenY: number;
  readonly stateAbbrev: string | null;
  readonly underConstructionPowerMw: number | null;
}

export interface QuickViewLayoutInput {
  readonly densityLimit: number;
  readonly facilities: readonly ScannerFacility[];
  readonly map: IMap;
}

export interface QuickViewLayoutResult {
  readonly cards: readonly QuickViewCard[];
  readonly hiddenCount: number;
  readonly totalCount: number;
}
