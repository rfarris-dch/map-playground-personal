import { onBeforeUnmount, shallowRef, watch } from "vue";
import { fetchMarketsBySelection } from "@/features/selection-tool/selection-tool.api";
import { buildMapOverlaysFetchKey } from "./map-overlays.service";
import {
  buildEmptyScannerMarketSelectionSummary,
  buildScannerMarketSelectionSummary,
  buildScannerMarketsRequest,
} from "./map-overlays-scanner-markets.service";
import type {
  UseMapOverlaysScannerMarketsOptions,
  UseMapOverlaysScannerMarketsResult,
} from "./use-map-overlays-scanner-markets.types";

const SCANNER_MARKETS_REFRESH_DEBOUNCE_MS = 260;

export function useMapOverlaysScannerMarkets(
  options: UseMapOverlaysScannerMarketsOptions
): UseMapOverlaysScannerMarketsResult {
  const scannerMarketSelection = shallowRef(buildEmptyScannerMarketSelectionSummary());
  let scannerMarketsAbortController: AbortController | null = null;
  let scannerMarketsRequestSequence = 0;
  let scannerMarketsDebounceTimer: number | null = null;
  let scannerMarketsLastFetchKey: string | null = null;
  let moveendBoundMap = options.map.value;

  function clearScannerMarketsState(): void {
    scannerMarketsAbortController?.abort();
    scannerMarketsAbortController = null;
    scannerMarketsRequestSequence += 1;
    scannerMarketsLastFetchKey = null;
    scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
  }

  function isStaleScannerMarketsRequest(requestSequence: number): boolean {
    return requestSequence !== scannerMarketsRequestSequence;
  }

  async function refreshScannerMarkets(): Promise<void> {
    const currentMap = options.map.value;
    if (currentMap === null || !options.scannerFetchEnabled.value) {
      clearScannerMarketsState();
      return;
    }

    const bounds = currentMap.getBounds();
    const mapBounds = {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    };
    const fetchKey = buildMapOverlaysFetchKey(mapBounds, "markets");
    if (fetchKey === scannerMarketsLastFetchKey) {
      return;
    }

    const request = buildScannerMarketsRequest(mapBounds);
    if (request === null) {
      scannerMarketsLastFetchKey = fetchKey;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary(
        "Market overlap is unavailable for wrapped viewport bounds."
      );
      return;
    }

    scannerMarketsLastFetchKey = fetchKey;
    scannerMarketsRequestSequence += 1;
    const requestSequence = scannerMarketsRequestSequence;
    scannerMarketsAbortController?.abort();
    const abortController = new AbortController();
    scannerMarketsAbortController = abortController;

    const result = await fetchMarketsBySelection(request, abortController.signal);
    if (isStaleScannerMarketsRequest(requestSequence)) {
      return;
    }

    if (result.ok) {
      scannerMarketSelection.value = buildScannerMarketSelectionSummary(result.data);
      return;
    }

    if (result.reason === "aborted") {
      return;
    }

    scannerMarketsLastFetchKey = null;
    scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary(
      typeof result.message === "string" ? result.message : "Market selection is unavailable."
    );
  }

  function scheduleScannerMarketsRefresh(): void {
    if (!options.scannerFetchEnabled.value) {
      clearScannerMarketsState();
      return;
    }

    if (typeof window === "undefined") {
      refreshScannerMarkets().catch((error: unknown) => {
        console.error("[map] scanner markets refresh failed", error);
      });
      return;
    }

    if (scannerMarketsDebounceTimer !== null) {
      window.clearTimeout(scannerMarketsDebounceTimer);
    }

    scannerMarketsDebounceTimer = window.setTimeout(() => {
      scannerMarketsDebounceTimer = null;
      refreshScannerMarkets().catch((error: unknown) => {
        console.error("[map] scanner markets refresh failed", error);
      });
    }, SCANNER_MARKETS_REFRESH_DEBOUNCE_MS);
  }

  const onMapMoveEnd = (): void => {
    scheduleScannerMarketsRefresh();
  };

  function unbindMoveendMap(): void {
    if (moveendBoundMap === null) {
      return;
    }

    moveendBoundMap.off("moveend", onMapMoveEnd);
    moveendBoundMap = null;
  }

  function bindMoveendMap(nextMap: UseMapOverlaysScannerMarketsOptions["map"]["value"]): void {
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
    [options.scannerFetchEnabled, () => options.map.value],
    ([nextScannerFetchEnabled, currentMap]) => {
      if (!(nextScannerFetchEnabled && currentMap !== null)) {
        clearScannerMarketsState();
        return;
      }

      scannerMarketsLastFetchKey = null;
      scheduleScannerMarketsRefresh();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (scannerMarketsDebounceTimer !== null) {
      window.clearTimeout(scannerMarketsDebounceTimer);
      scannerMarketsDebounceTimer = null;
    }

    unbindMoveendMap();
    clearScannerMarketsState();
  });

  return {
    scannerMarketSelection,
  };
}
