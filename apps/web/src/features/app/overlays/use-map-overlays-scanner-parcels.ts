import type { ParcelEnrichRequest, ParcelsFeatureCollection } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import {
  buildCenterLimitedBbox,
  buildFacilityAnchorParcelRequests,
  buildMapOverlaysFetchKey,
} from "@/features/app/overlays/map-overlays.service";
import {
  appendScannerAnchorFeatures,
  buildScannerSelectionFromAccumulator,
  createScannerAnchorAccumulator,
  createScannerAnchorRequests,
  createScannerBboxRequest,
  mergeScannerAnchorCursor,
} from "@/features/app/overlays/map-overlays-scanner-parcels.service";
import type {
  ScannerAnchorSelectionArgs,
  ScannerParcelsRefreshScope,
  ScannerParcelsSelection,
  UseMapOverlaysScannerParcelsOptions,
} from "@/features/app/overlays/use-map-overlays-scanner-parcels.types";
import {
  fetchSpatialAnalysisParcelsPages,
  type SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";

const SCANNER_PARCELS_REFRESH_DEBOUNCE_MS = 260;

function isPolicyRejectedError(result: SpatialAnalysisParcelsPagesResult): boolean {
  return !result.ok && "code" in result && result.code === "POLICY_REJECTED";
}

export function useMapOverlaysScannerParcels(options: UseMapOverlaysScannerParcelsOptions) {
  const scannerParcelFeatures = shallowRef<ParcelsFeatureCollection["features"]>([]);
  const scannerParcelTruncated = shallowRef<boolean>(false);
  const scannerParcelNextCursor = shallowRef<string | null>(null);
  const scannerParcelsError = shallowRef<string | null>(null);
  const isScannerParcelsLoading = shallowRef<boolean>(false);
  let scannerParcelsAbortController: AbortController | null = null;
  let scannerParcelsRequestSequence = 0;
  let scannerParcelsDebounceTimer: number | null = null;
  let scannerParcelsLastFetchKey: string | null = null;
  let moveendBoundMap: IMap | null = null;

  function clearScannerParcelsState(): void {
    scannerParcelsAbortController?.abort();
    scannerParcelsAbortController = null;
    scannerParcelsRequestSequence += 1;
    scannerParcelsLastFetchKey = null;
    isScannerParcelsLoading.value = false;
    scannerParcelsError.value = null;
    scannerParcelFeatures.value = [];
    scannerParcelTruncated.value = false;
    scannerParcelNextCursor.value = null;
  }

  function isStaleScannerParcelsRequest(requestSequence: number): boolean {
    return requestSequence !== scannerParcelsRequestSequence;
  }

  function startScannerParcelsRefresh(): ScannerParcelsRefreshScope | null {
    const currentMap = options.map.value;
    if (currentMap === null || !options.scannerActive.value) {
      clearScannerParcelsState();
      return null;
    }

    const bounds = currentMap.getBounds();
    const mapBounds = {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    };
    const fetchKey = buildMapOverlaysFetchKey(
      mapBounds,
      options.expectedParcelsIngestionRunId.value
    );
    if (fetchKey === scannerParcelsLastFetchKey) {
      return null;
    }

    scannerParcelsLastFetchKey = fetchKey;
    scannerParcelsRequestSequence += 1;
    const requestSequence = scannerParcelsRequestSequence;
    scannerParcelsAbortController?.abort();
    const abortController = new AbortController();
    scannerParcelsAbortController = abortController;
    isScannerParcelsLoading.value = true;
    scannerParcelsError.value = null;

    return {
      mapBounds,
      requestSequence,
      abortController,
    };
  }

  async function fetchScannerParcelsFromBbox(
    scope: ScannerParcelsRefreshScope
  ): Promise<SpatialAnalysisParcelsPagesResult> {
    const request = createScannerBboxRequest(scope.mapBounds);
    let result = await fetchSpatialAnalysisParcelsPages({
      expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
      request,
      signal: scope.abortController.signal,
      cursorRepeatLogContext: "scanner-viewport",
    });
    if (!isPolicyRejectedError(result)) {
      return result;
    }

    const fallbackRequest = createScannerBboxRequest(buildCenterLimitedBbox(scope.mapBounds));
    result = await fetchSpatialAnalysisParcelsPages({
      expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
      request: fallbackRequest,
      signal: scope.abortController.signal,
      cursorRepeatLogContext: "scanner-fallback-bbox",
    });
    return result;
  }

  function buildScannerAnchorRequests(): readonly ParcelEnrichRequest[] {
    return createScannerAnchorRequests({
      buildFacilityAnchorParcelRequests,
      colocationFeatures: options.colocationViewportFeatures.value,
      hyperscaleFeatures: options.hyperscaleViewportFeatures.value,
    });
  }

  async function fetchScannerAnchorSelection(
    selectionArgs: ScannerAnchorSelectionArgs
  ): Promise<ScannerParcelsSelection | null> {
    const accumulator = createScannerAnchorAccumulator({
      selection: selectionArgs.selection,
      nextCursor: selectionArgs.nextCursor,
    });

    for (const anchorRequest of selectionArgs.anchorRequests) {
      const anchorResult = await fetchSpatialAnalysisParcelsPages({
        expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
        request: anchorRequest,
        signal: selectionArgs.signal,
        cursorRepeatLogContext: "scanner-anchor-bbox",
      });
      if (isStaleScannerParcelsRequest(selectionArgs.requestSequence)) {
        return null;
      }

      if (!anchorResult.ok) {
        if (anchorResult.reason === "aborted") {
          return null;
        }
        continue;
      }

      appendScannerAnchorFeatures(accumulator.parcelById, anchorResult.features);
      accumulator.truncated = accumulator.truncated || anchorResult.truncated;
      accumulator.nextCursor = mergeScannerAnchorCursor(
        accumulator.nextCursor,
        anchorResult.nextCursor
      );
    }

    return buildScannerSelectionFromAccumulator({
      selection: selectionArgs.selection,
      accumulator,
    });
  }

  function enrichScannerSelectionWithAnchors(args: {
    readonly nextCursor: string | null;
    readonly requestSequence: number;
    readonly selection: ScannerParcelsSelection;
    readonly signal: AbortSignal;
  }): Promise<ScannerParcelsSelection | null> {
    if (args.selection.features.length > 0) {
      return Promise.resolve(args.selection);
    }

    const anchorRequests = buildScannerAnchorRequests();
    if (anchorRequests.length === 0) {
      return Promise.resolve(args.selection);
    }

    return fetchScannerAnchorSelection({
      anchorRequests,
      selection: args.selection,
      nextCursor: args.nextCursor,
      requestSequence: args.requestSequence,
      signal: args.signal,
    });
  }

  function applyFailedScannerParcelsFetch(result: SpatialAnalysisParcelsPagesResult): void {
    if (result.ok || result.reason === "aborted") {
      return;
    }

    scannerParcelsError.value = `Parcels query failed (${result.reason}).`;
    scannerParcelFeatures.value = [];
    scannerParcelTruncated.value = false;
    scannerParcelNextCursor.value = null;
    scannerParcelsLastFetchKey = null;
    console.error("[map] scanner parcels viewport query failed", result);
  }

  async function refreshScannerParcels(): Promise<void> {
    const scope = startScannerParcelsRefresh();
    if (scope === null) {
      return;
    }

    const result = await fetchScannerParcelsFromBbox(scope);
    if (isStaleScannerParcelsRequest(scope.requestSequence)) {
      return;
    }

    isScannerParcelsLoading.value = false;
    if (!result.ok) {
      applyFailedScannerParcelsFetch(result);
      return;
    }

    const initialSelection: ScannerParcelsSelection = {
      features: result.features,
      truncated: result.truncated,
      nextCursor: result.nextCursor,
    };
    const selection = await enrichScannerSelectionWithAnchors({
      selection: initialSelection,
      nextCursor: result.nextCursor,
      requestSequence: scope.requestSequence,
      signal: scope.abortController.signal,
    });
    if (selection === null || isStaleScannerParcelsRequest(scope.requestSequence)) {
      return;
    }

    scannerParcelFeatures.value = selection.features;
    scannerParcelTruncated.value = selection.truncated;
    scannerParcelNextCursor.value = selection.nextCursor;
  }

  function triggerScannerParcelsRefresh(): void {
    refreshScannerParcels().catch((error: unknown) => {
      isScannerParcelsLoading.value = false;
      scannerParcelsError.value = "Parcels query failed (unexpected).";
      scannerParcelsLastFetchKey = null;
      console.error("[map] scanner parcels refresh failed", error);
    });
  }

  function scheduleScannerParcelsRefresh(): void {
    if (!options.scannerActive.value) {
      return;
    }

    if (typeof window === "undefined") {
      triggerScannerParcelsRefresh();
      return;
    }

    if (scannerParcelsDebounceTimer !== null) {
      window.clearTimeout(scannerParcelsDebounceTimer);
    }

    scannerParcelsDebounceTimer = window.setTimeout(() => {
      scannerParcelsDebounceTimer = null;
      triggerScannerParcelsRefresh();
    }, SCANNER_PARCELS_REFRESH_DEBOUNCE_MS);
  }

  const onMapMoveEnd = (): void => {
    scheduleScannerParcelsRefresh();
  };

  function unbindMoveendMap(): void {
    if (moveendBoundMap === null) {
      return;
    }

    moveendBoundMap.off("moveend", onMapMoveEnd);
    moveendBoundMap = null;
  }

  function bindMoveendMap(nextMap: IMap | null): void {
    unbindMoveendMap();

    if (nextMap === null) {
      return;
    }

    moveendBoundMap = nextMap;
    nextMap.on("moveend", onMapMoveEnd);
  }

  watch(
    () => options.map.value,
    (nextMap) => {
      bindMoveendMap(nextMap);
    },
    { immediate: true }
  );

  watch(
    [
      () => options.colocationViewportFeatures.value,
      () => options.hyperscaleViewportFeatures.value,
      () => options.expectedParcelsIngestionRunId.value,
      options.scannerActive,
    ],
    ([, , , nextScannerActive]) => {
      if (!nextScannerActive) {
        return;
      }

      scannerParcelsLastFetchKey = null;
      scheduleScannerParcelsRefresh();
    },
    { immediate: false }
  );

  watch(
    [options.scannerActive, () => options.map.value],
    ([nextScannerActive, currentMap]) => {
      if (!(nextScannerActive && currentMap !== null)) {
        clearScannerParcelsState();
        return;
      }

      scannerParcelsLastFetchKey = null;
      scheduleScannerParcelsRefresh();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (scannerParcelsDebounceTimer !== null) {
      window.clearTimeout(scannerParcelsDebounceTimer);
      scannerParcelsDebounceTimer = null;
    }

    unbindMoveendMap();
    clearScannerParcelsState();
  });

  return {
    scannerParcelFeatures,
    scannerParcelTruncated,
    scannerParcelNextCursor,
    scannerParcelsError,
    isScannerParcelsLoading,
  };
}
