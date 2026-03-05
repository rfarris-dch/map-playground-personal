import type { FacilityPerspective } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import type { ScannerFacility } from "@/features/scanner/scanner.types";

export interface QuickViewCard {
  readonly commissionedPowerMw: number | null;
  readonly facilityName: string;
  readonly id: string;
  readonly perspective: FacilityPerspective;
  readonly providerName: string;
  readonly screenX: number;
  readonly screenY: number;
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
