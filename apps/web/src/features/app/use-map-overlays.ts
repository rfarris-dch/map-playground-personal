import type { ParcelEnrichRequest, ParcelsFeatureCollection } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import {
  buildCenterLimitedBbox,
  buildFacilityAnchorParcelRequests,
  buildMapOverlaysFetchKey,
  readMapOverlaysQueryState,
  writeMapOverlaysQueryState,
} from "@/features/app/map-overlays.service";
import type { MapBounds, UseMapOverlaysArgs } from "@/features/app/map-overlays.types";
import { buildScannerCsv, buildScannerSummary } from "@/features/scanner/scanner.service";
import {
  fetchSpatialAnalysisParcelsPages,
  type SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";

const SCANNER_PARCELS_PAGE_SIZE = 20_000;
const SCANNER_PARCELS_REFRESH_DEBOUNCE_MS = 260;
function isPolicyRejectedError(result: SpatialAnalysisParcelsPagesResult): boolean {
  return !result.ok && result.code === "POLICY_REJECTED";
}

function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function useMapOverlays(args: UseMapOverlaysArgs) {
  const scannerParcelFeatures = shallowRef<ParcelsFeatureCollection["features"]>([]);
  const scannerParcelTruncated = shallowRef<boolean>(false);
  const scannerParcelNextCursor = shallowRef<string | null>(null);
  const scannerParcelsError = shallowRef<string | null>(null);
  const isScannerParcelsLoading = shallowRef<boolean>(false);
  const quickViewActive = shallowRef<boolean>(false);
  const scannerActive = shallowRef<boolean>(false);
  const quickViewObjectCount = shallowRef<number>(0);
  const overlaysQueryHydrated = shallowRef<boolean>(false);
  let scannerParcelsAbortController: AbortController | null = null;
  let scannerParcelsRequestSequence = 0;
  let scannerParcelsDebounceTimer: number | null = null;
  let scannerParcelsLastFetchKey: string | null = null;
  let moveendBoundMap: IMap | null = null;

  const scannerSummary = computed(() =>
    buildScannerSummary({
      colocationFeatures: args.colocationViewportFeatures.value,
      hyperscaleFeatures: args.hyperscaleViewportFeatures.value,
      parcelFeatures: scannerParcelFeatures.value,
      parcelTruncated: scannerParcelTruncated.value,
      parcelNextCursor: scannerParcelNextCursor.value,
    })
  );
  const scannerFacilities = computed(() => scannerSummary.value.facilities);
  const scannerTotalCount = computed(() => scannerSummary.value.totalCount);
  const scannerIsFiltered = computed(
    () => !(args.visiblePerspectives.value.colocation && args.visiblePerspectives.value.hyperscale)
  );
  const isSelectionSummaryVisible = computed(() => args.measureState.value.selectionRing !== null);
  const isMeasureDrawing = computed(
    () => args.measureState.value.mode === "area" && !args.measureState.value.isSelectionComplete
  );
  const isQuickViewVisible = computed(
    () => quickViewActive.value && scannerTotalCount.value > 0 && !isMeasureDrawing.value
  );
  const isScannerVisible = computed(
    () => scannerActive.value && !isSelectionSummaryVisible.value && !isMeasureDrawing.value
  );
  const isQuickViewDensityOk = computed(
    () => quickViewObjectCount.value > 0 && quickViewObjectCount.value <= 15
  );

  function setQuickViewActive(active: boolean): void {
    quickViewActive.value = active;
    if (!active) {
      quickViewObjectCount.value = 0;
    }
  }

  function toggleQuickView(): void {
    setQuickViewActive(!quickViewActive.value);
  }

  function setScannerActive(active: boolean): void {
    scannerActive.value = active;
  }

  function toggleScanner(): void {
    setScannerActive(!scannerActive.value);
  }

  function setQuickViewObjectCount(count: number): void {
    quickViewObjectCount.value = count;
  }

  function exportScannerSelection(): void {
    const summary = scannerSummary.value;
    if (summary.totalCount === 0) {
      return;
    }

    const csv = buildScannerCsv(summary);
    const dateLabel = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `map-scanner-${dateLabel}.csv`;
    downloadLink.click();
    URL.revokeObjectURL(url);
  }

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

  type ScannerMapBounds = MapBounds;

  interface ScannerParcelsRefreshScope {
    readonly abortController: AbortController;
    readonly mapBounds: ScannerMapBounds;
    readonly requestSequence: number;
  }

  interface ScannerParcelsSelection {
    readonly features: ParcelsFeatureCollection["features"];
    readonly nextCursor: string | null;
    readonly truncated: boolean;
  }

  function isStaleScannerParcelsRequest(requestSequence: number): boolean {
    return requestSequence !== scannerParcelsRequestSequence;
  }

  function buildScannerBboxRequest(mapBounds: ScannerMapBounds): ParcelEnrichRequest {
    return {
      aoi: {
        type: "bbox",
        bbox: mapBounds,
      },
      profile: "analysis_v1",
      includeGeometry: "centroid",
      pageSize: SCANNER_PARCELS_PAGE_SIZE,
      format: "json",
    };
  }

  function startScannerParcelsRefresh(): ScannerParcelsRefreshScope | null {
    const currentMap = args.map.value;
    if (currentMap === null || !scannerActive.value) {
      clearScannerParcelsState();
      return null;
    }

    const bounds = currentMap.getBounds();
    const mapBounds: ScannerMapBounds = {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    };
    const fetchKey = buildMapOverlaysFetchKey(mapBounds);
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
    const request = buildScannerBboxRequest(scope.mapBounds);
    let result = await fetchSpatialAnalysisParcelsPages({
      request,
      signal: scope.abortController.signal,
      cursorRepeatLogContext: "scanner-viewport",
    });
    if (!isPolicyRejectedError(result)) {
      return result;
    }

    const fallbackRequest = buildScannerBboxRequest(buildCenterLimitedBbox(scope.mapBounds));
    result = await fetchSpatialAnalysisParcelsPages({
      request: fallbackRequest,
      signal: scope.abortController.signal,
      cursorRepeatLogContext: "scanner-fallback-bbox",
    });
    return result;
  }

  interface ScannerAnchorSelectionAccumulator {
    nextCursor: string | null;
    readonly parcelById: Map<string, ParcelsFeatureCollection["features"][number]>;
    truncated: boolean;
  }

  function buildScannerAnchorRequests(): readonly ParcelEnrichRequest[] {
    return buildFacilityAnchorParcelRequests({
      colocationFeatures: args.colocationViewportFeatures.value,
      hyperscaleFeatures: args.hyperscaleViewportFeatures.value,
      pageSize: SCANNER_PARCELS_PAGE_SIZE,
    });
  }

  function createScannerAnchorAccumulator(args: {
    readonly nextCursor: string | null;
    readonly selection: ScannerParcelsSelection;
  }): ScannerAnchorSelectionAccumulator {
    return {
      parcelById: new Map<string, ParcelsFeatureCollection["features"][number]>(),
      truncated: args.selection.truncated,
      nextCursor: args.nextCursor,
    };
  }

  function appendScannerAnchorFeatures(
    parcelById: Map<string, ParcelsFeatureCollection["features"][number]>,
    features: ParcelsFeatureCollection["features"]
  ): void {
    for (const feature of features) {
      parcelById.set(feature.properties.parcelId, feature);
    }
  }

  function mergeScannerAnchorCursor(
    currentCursor: string | null,
    incomingCursor: string | null
  ): string | null {
    if (currentCursor === null && incomingCursor !== null) {
      return incomingCursor;
    }

    return currentCursor;
  }

  function buildScannerSelectionFromAccumulator(args: {
    readonly accumulator: ScannerAnchorSelectionAccumulator;
    readonly selection: ScannerParcelsSelection;
  }): ScannerParcelsSelection {
    if (args.accumulator.parcelById.size === 0) {
      return args.selection;
    }

    return {
      features: [...args.accumulator.parcelById.values()],
      truncated: args.accumulator.truncated,
      nextCursor: args.accumulator.truncated ? args.accumulator.nextCursor : null,
    };
  }

  async function fetchScannerAnchorSelection(args: {
    readonly anchorRequests: readonly ParcelEnrichRequest[];
    readonly nextCursor: string | null;
    readonly requestSequence: number;
    readonly selection: ScannerParcelsSelection;
    readonly signal: AbortSignal;
  }): Promise<ScannerParcelsSelection | null> {
    const accumulator = createScannerAnchorAccumulator({
      selection: args.selection,
      nextCursor: args.nextCursor,
    });

    for (const anchorRequest of args.anchorRequests) {
      const anchorResult = await fetchSpatialAnalysisParcelsPages({
        request: anchorRequest,
        signal: args.signal,
        cursorRepeatLogContext: "scanner-anchor-bbox",
      });
      if (isStaleScannerParcelsRequest(args.requestSequence)) {
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
      selection: args.selection,
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
    if (!scannerActive.value) {
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

  function handleEnterShortcut(event: KeyboardEvent): void {
    const measureState = args.measureState.value;
    if (
      measureState.mode === "area" &&
      measureState.canFinishSelection &&
      !measureState.isSelectionComplete
    ) {
      event.preventDefault();
      args.finishMeasureSelection();
    }
  }

  function handleEscapeShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    const measureState = args.measureState.value;

    if (measureState.mode === "area" && measureState.isSelectionComplete) {
      args.clearMeasure();
      return;
    }

    if (measureState.mode !== "off") {
      args.setMeasureMode("off");
      return;
    }

    if (scannerActive.value) {
      setScannerActive(false);
      return;
    }

    if (quickViewActive.value) {
      setQuickViewActive(false);
    }
  }

  function onWindowKeyDown(event: KeyboardEvent): void {
    if (isKeyboardInputTarget(event.target)) {
      return;
    }

    const key = event.key;
    if (key === "g" || key === "G") {
      event.preventDefault();
      toggleQuickView();
      return;
    }

    if (key === "v" || key === "V") {
      event.preventDefault();
      toggleScanner();
      return;
    }

    if (key === "Enter") {
      handleEnterShortcut(event);
      return;
    }

    if (key === "Escape") {
      handleEscapeShortcut(event);
    }
  }

  watch(
    () => args.map.value,
    (nextMap) => {
      bindMoveendMap(nextMap);
    },
    { immediate: true }
  );

  watch(
    [
      () => args.colocationViewportFeatures.value,
      () => args.hyperscaleViewportFeatures.value,
      scannerActive,
    ],
    ([, , nextScannerActive]) => {
      if (!nextScannerActive) {
        return;
      }

      scannerParcelsLastFetchKey = null;
      scheduleScannerParcelsRefresh();
    },
    { immediate: false }
  );

  watch(
    [scannerActive, () => args.map.value],
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

  watch(
    [quickViewActive, scannerActive],
    ([nextQuickView, nextScanner]) => {
      if (!overlaysQueryHydrated.value) {
        return;
      }

      writeMapOverlaysQueryState({
        quickView: nextQuickView,
        scanner: nextScanner,
      });
    },
    { immediate: false }
  );

  onMounted(() => {
    const queryState = readMapOverlaysQueryState();
    quickViewActive.value = queryState.quickView;
    scannerActive.value = queryState.scanner;
    overlaysQueryHydrated.value = true;

    window.addEventListener("keydown", onWindowKeyDown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onWindowKeyDown);
    overlaysQueryHydrated.value = false;

    if (scannerParcelsDebounceTimer !== null) {
      window.clearTimeout(scannerParcelsDebounceTimer);
      scannerParcelsDebounceTimer = null;
    }

    unbindMoveendMap();
    clearScannerParcelsState();
  });

  return {
    quickViewActive,
    scannerActive,
    scannerSummary,
    scannerFacilities,
    scannerTotalCount,
    scannerIsFiltered,
    isScannerParcelsLoading,
    scannerParcelsError,
    isQuickViewVisible,
    isScannerVisible,
    isQuickViewDensityOk,
    quickViewObjectCount,
    setQuickViewActive,
    toggleQuickView,
    setScannerActive,
    toggleScanner,
    setQuickViewObjectCount,
    exportScannerSelection,
  };
}
