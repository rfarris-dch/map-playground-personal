import type { ParcelsFeatureCollection } from "@map-migration/http-contracts";
import type { ComputedRef, ShallowRef } from "vue";
import type { UseMapOverlaysArgs } from "@/features/app/overlays/map-overlays.types";
import type { ScannerSummary } from "@/features/scanner/scanner.types";

export interface MapOverlaysShortcutState {
  readonly quickViewActive: ShallowRef<boolean>;
  readonly quickViewObjectCount: ShallowRef<number>;
  readonly scannerActive: ShallowRef<boolean>;
}

export interface MapOverlaysScannerParcelState {
  readonly isScannerParcelsLoading: ShallowRef<boolean>;
  readonly scannerParcelFeatures: ShallowRef<ParcelsFeatureCollection["features"]>;
  readonly scannerParcelNextCursor: ShallowRef<string | null>;
  readonly scannerParcelsBlockedReason: ShallowRef<string | null>;
  readonly scannerParcelTruncated: ShallowRef<boolean>;
}

export interface UseMapOverlaysDisplayOptions {
  readonly args: UseMapOverlaysArgs;
  readonly overlayShortcuts: MapOverlaysShortcutState;
  readonly overlaysBlockedReason: ComputedRef<string | null>;
  readonly scannerParcels: MapOverlaysScannerParcelState;
  readonly scannerParcelsBlockedReason: ComputedRef<string | null>;
}

export interface UseMapOverlaysDisplayResult {
  readonly isQuickViewDensityOk: ComputedRef<boolean>;
  readonly isQuickViewVisible: ComputedRef<boolean>;
  readonly isScannerVisible: ComputedRef<boolean>;
  readonly overlayStatusMessage: ComputedRef<string | null>;
  readonly scannerEmptyMessage: ComputedRef<string>;
  readonly scannerFacilities: ComputedRef<ScannerSummary["facilities"]>;
  readonly scannerIsFiltered: ComputedRef<boolean>;
  readonly scannerSummary: ComputedRef<ScannerSummary>;
  readonly scannerTotalCount: ComputedRef<number>;
}
