import { computed } from "vue";
import { resolveMapOverlaysBlockedReason } from "@/features/app/overlays/map-overlays.service";
import type { UseMapOverlaysArgs } from "@/features/app/overlays/map-overlays.types";
import { resolveQuickViewDisabledReason } from "@/features/app/overlays/map-overlays-availability.service";
import { exportScannerSummary } from "@/features/app/overlays/map-overlays-export.service";
import { useMapOverlaysDisplay } from "@/features/app/overlays/use-map-overlays-display";
import { useMapOverlaysScannerParcels } from "@/features/app/overlays/use-map-overlays-scanner-parcels";
import { useMapOverlaysShortcuts } from "@/features/app/overlays/use-map-overlays-shortcuts";

export function useMapOverlays(args: UseMapOverlaysArgs) {
  const overlaysBlockedReason = computed(() =>
    resolveMapOverlaysBlockedReason({
      visiblePerspectives: args.visiblePerspectives.value,
      facilitiesStatus: args.facilitiesStatus.value,
    })
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
    clearMeasure: args.clearMeasure,
    finishMeasureSelection: args.finishMeasureSelection,
    measureState: args.measureState,
    quickViewDisabledReason,
    setMeasureMode: args.setMeasureMode,
  });
  const scannerParcels = useMapOverlaysScannerParcels({
    colocationViewportFeatures: args.colocationViewportFeatures,
    expectedParcelsIngestionRunId: args.expectedParcelsIngestionRunId,
    hyperscaleViewportFeatures: args.hyperscaleViewportFeatures,
    map: args.map,
    scannerActive: overlayShortcuts.scannerActive,
  });
  const overlayDisplay = useMapOverlaysDisplay({
    args,
    overlayShortcuts,
    overlaysBlockedReason,
    scannerParcels,
  });

  function exportScannerSelection(): void {
    exportScannerSummary(overlayDisplay.scannerSummary.value);
  }

  return {
    quickViewActive: overlayShortcuts.quickViewActive,
    scannerActive: overlayShortcuts.scannerActive,
    scannerSummary: overlayDisplay.scannerSummary,
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
