import { computed } from "vue";
import {
  resolveMapOverlaysBlockedReason,
  resolveScannerParcelsBlockedReason,
} from "@/features/app/overlays/map-overlays.service";
import type { UseMapOverlaysArgs } from "@/features/app/overlays/map-overlays.types";
import { resolveQuickViewDisabledReason } from "@/features/app/overlays/map-overlays-availability.service";
import { exportScannerSummary } from "@/features/app/overlays/map-overlays-export.service";
import { useMapOverlaysDisplay } from "@/features/app/overlays/use-map-overlays-display";
import { useMapOverlaysScannerMarkets } from "@/features/app/overlays/use-map-overlays-scanner-markets";
import { useMapOverlaysScannerParcels } from "@/features/app/overlays/use-map-overlays-scanner-parcels";
import { useMapOverlaysShortcuts } from "@/features/app/overlays/use-map-overlays-shortcuts";

export function useMapOverlays(args: UseMapOverlaysArgs) {
  const overlaysBlockedReason = computed(() =>
    resolveMapOverlaysBlockedReason({
      visiblePerspectives: args.visiblePerspectives.value,
      facilitiesStatus: args.facilitiesStatus.value,
    })
  );
  const isSelectionSummaryVisible = computed(
    () => args.sketchMeasureState.value.completedAreaGeometry !== null
  );
  const isMeasureDrawing = computed(
    () =>
      args.sketchMeasureState.value.mode === "area" && !args.sketchMeasureState.value.isAreaComplete
  );
  const quickViewDisabledReason = computed(() =>
    resolveQuickViewDisabledReason({
      colocationFeatures: args.colocationViewportFeatures.value,
      facilitiesStatus: args.facilitiesStatus.value,
      hyperscaleFeatures: args.hyperscaleViewportFeatures.value,
      visiblePerspectives: args.visiblePerspectives.value,
    })
  );
  const overlayShortcuts = useMapOverlaysShortcuts({
    clearSketchMeasure: args.clearSketchMeasure,
    finishSketchMeasureArea: args.finishSketchMeasureArea,
    quickViewDisabledReason,
    setSketchMeasureMode: args.setSketchMeasureMode,
    sketchMeasureState: args.sketchMeasureState,
  });
  const scannerParcels = useMapOverlaysScannerParcels({
    colocationViewportFeatures: args.colocationViewportFeatures,
    expectedParcelsIngestionRunId: args.expectedParcelsIngestionRunId,
    hyperscaleViewportFeatures: args.hyperscaleViewportFeatures,
    map: args.map,
    scannerActive: overlayShortcuts.scannerActive,
    scannerFetchEnabled: computed(
      () =>
        overlayShortcuts.scannerActive.value &&
        overlaysBlockedReason.value === null &&
        resolveScannerParcelsBlockedReason(args.parcelsStatus.value) === null &&
        !isSelectionSummaryVisible.value &&
        !isMeasureDrawing.value
    ),
  });
  const scannerMarkets = useMapOverlaysScannerMarkets({
    map: args.map,
    scannerFetchEnabled: computed(
      () =>
        overlayShortcuts.scannerActive.value &&
        !isSelectionSummaryVisible.value &&
        !isMeasureDrawing.value
    ),
  });
  const scannerParcelsBlockedReason = computed(
    () =>
      scannerParcels.scannerParcelsBlockedReason.value ??
      resolveScannerParcelsBlockedReason(args.parcelsStatus.value)
  );
  const overlayDisplay = useMapOverlaysDisplay({
    args,
    overlayShortcuts,
    overlaysBlockedReason,
    scannerParcelsBlockedReason,
    scannerParcels,
  });

  function exportScannerSelection(): void {
    exportScannerSummary(overlayDisplay.scannerSummary.value);
  }

  return {
    quickViewActive: overlayShortcuts.quickViewActive,
    scannerActive: overlayShortcuts.scannerActive,
    scannerSummary: overlayDisplay.scannerSummary,
    scannerMarketSelection: scannerMarkets.scannerMarketSelection,
    scannerFacilities: overlayDisplay.scannerFacilities,
    scannerTotalCount: overlayDisplay.scannerTotalCount,
    scannerIsFiltered: overlayDisplay.scannerIsFiltered,
    overlaysBlockedReason,
    quickViewDisabledReason,
    scannerEmptyMessage: overlayDisplay.scannerEmptyMessage,
    overlayStatusMessage: overlayDisplay.overlayStatusMessage,
    isScannerParcelsLoading: scannerParcels.isScannerParcelsLoading,
    scannerParcelsError: scannerParcels.scannerParcelsError,
    isQuickViewVisible: overlayDisplay.isQuickViewVisible,
    isScannerVisible: overlayDisplay.isScannerVisible,
    isQuickViewDensityOk: overlayDisplay.isQuickViewDensityOk,
    quickViewObjectCount: overlayShortcuts.quickViewObjectCount,
    setQuickViewActive: overlayShortcuts.setQuickViewActive,
    toggleQuickView: overlayShortcuts.toggleQuickView,
    setScannerActive: overlayShortcuts.setScannerActive,
    toggleScanner: overlayShortcuts.toggleScanner,
    setQuickViewObjectCount: overlayShortcuts.setQuickViewObjectCount,
    exportScannerSelection,
  };
}
