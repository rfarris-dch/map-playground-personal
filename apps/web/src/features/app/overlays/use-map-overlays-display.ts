import { computed } from "vue";
import type {
  UseMapOverlaysDisplayOptions,
  UseMapOverlaysDisplayResult,
} from "@/features/app/overlays/use-map-overlays-display.types";
import { buildScannerSummary } from "@/features/scanner/scanner.service";

export function useMapOverlaysDisplay(
  options: UseMapOverlaysDisplayOptions
): UseMapOverlaysDisplayResult {
  const scannerSummary = computed(() =>
    buildScannerSummary({
      colocationFeatures: options.args.colocationViewportFeatures.value,
      hyperscaleFeatures: options.args.hyperscaleViewportFeatures.value,
      parcelFeatures: options.scannerParcels.scannerParcelFeatures.value,
      parcelTruncated: options.scannerParcels.scannerParcelTruncated.value,
      parcelNextCursor: options.scannerParcels.scannerParcelNextCursor.value,
    })
  );
  const scannerFacilities = computed(() => scannerSummary.value.facilities);
  const scannerTotalCount = computed(() => scannerSummary.value.totalCount);
  const scannerIsFiltered = computed(
    () =>
      !(
        options.args.visiblePerspectives.value.colocation &&
        options.args.visiblePerspectives.value.hyperscale
      )
  );
  const isSelectionSummaryVisible = computed(
    () => options.args.measureState.value.selectionRing !== null
  );
  const isMeasureDrawing = computed(
    () =>
      options.args.measureState.value.mode === "area" &&
      !options.args.measureState.value.isSelectionComplete
  );
  const isQuickViewVisible = computed(
    () =>
      options.overlayShortcuts.quickViewActive.value &&
      scannerTotalCount.value > 0 &&
      !isMeasureDrawing.value
  );
  const isScannerVisible = computed(
    () =>
      options.overlayShortcuts.scannerActive.value &&
      !isSelectionSummaryVisible.value &&
      !isMeasureDrawing.value
  );
  const isQuickViewDensityOk = computed(
    () =>
      options.overlayShortcuts.quickViewObjectCount.value > 0 &&
      options.overlayShortcuts.quickViewObjectCount.value <= 15
  );
  const scannerEmptyMessage = computed(() => {
    if (options.overlaysBlockedReason.value !== null) {
      return options.overlaysBlockedReason.value;
    }

    if (options.scannerParcels.isScannerParcelsLoading.value) {
      return "Loading parcels in current viewport…";
    }

    return "No facilities or parcels in this viewport.";
  });
  const overlayStatusMessage = computed(() => {
    if (options.overlayShortcuts.quickViewActive.value && !isQuickViewDensityOk.value) {
      return "showing largest facilities only";
    }

    if (options.overlaysBlockedReason.value !== null) {
      return options.overlaysBlockedReason.value;
    }

    if (scannerTotalCount.value === 0) {
      return "no facilities in current viewport";
    }

    return null;
  });

  return {
    scannerSummary,
    scannerFacilities,
    scannerTotalCount,
    scannerIsFiltered,
    scannerEmptyMessage,
    overlayStatusMessage,
    isQuickViewVisible,
    isScannerVisible,
    isQuickViewDensityOk,
  };
}
