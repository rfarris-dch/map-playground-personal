import type { IMap } from "@map-migration/map-engine";
import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { FacilityDetailPayload } from "@/features/facilities/facility-detail/detail.types";
import type { FacilityHoverState } from "@/features/facilities/hover.types";
import type { FiberLocatorHoverState } from "@/features/fiber-locator/hover.types";
import type { ParcelDetailPayload } from "@/features/parcels/parcel-detail/detail.types";
import type { SelectedParcelRef } from "@/features/parcels/parcels.types";
import type { PowerHoverState } from "@/features/power/power-hover.types";
import type { ScannerFacility, ScannerSummary } from "@/features/scanner/scanner.types";

export interface MapPageOverlaysProps {
  readonly facilityDetail: FacilityDetailPayload | null;
  readonly hoveredBoundary: BoundaryHoverState | null;
  readonly hoveredFacility: FacilityHoverState | null;
  readonly hoveredFiber: FiberLocatorHoverState | null;
  readonly hoveredPower: PowerHoverState | null;
  readonly isFacilityDetailError: boolean;
  readonly isFacilityDetailLoading: boolean;
  readonly isParcelDetailError: boolean;
  readonly isParcelDetailLoading: boolean;
  readonly isQuickViewVisible: boolean;
  readonly isScannerParcelsLoading: boolean;
  readonly isScannerVisible: boolean;
  readonly map: IMap | null;
  readonly overlayStatusMessage: string | null;
  readonly parcelDetail: ParcelDetailPayload | null;
  readonly scannerEmptyMessage: string;
  readonly scannerFacilities: readonly ScannerFacility[];
  readonly scannerIsFiltered: boolean;
  readonly scannerParcelsError: string | null;
  readonly scannerSummary: ScannerSummary;
  readonly selectedFacility: SelectedFacilityRef | null;
  readonly selectedParcel: SelectedParcelRef | null;
}

export interface MapPageOverlaysEmits {
  "close-facility-detail": [];
  "close-parcel-detail": [];
  "close-scanner": [];
  "export-scanner-selection": [];
  "open-scanner-dashboard": [];
  "quick-view-object-count": [count: number];
  "select-facility": [facility: SelectedFacilityRef];
}
