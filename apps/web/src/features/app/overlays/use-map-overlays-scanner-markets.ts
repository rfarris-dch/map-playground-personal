import type { ApiEffectError } from "@map-migration/core-runtime/api";
import { ApiAbortedError, getApiErrorMessage } from "@map-migration/core-runtime/api";
import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useDebouncedLatestEffectTask } from "@/composables/use-debounced-latest-effect-task";
import {
  createAppPerformanceTimer,
  recordAppPerformanceCounter,
} from "@/features/app/diagnostics/app-performance.service";
import { shouldRefreshViewportData } from "@/features/app/interaction/map-interaction-policy.service";
import { fetchMarketsBySelectionEffect } from "@/features/selection-tool/selection-tool.api";
import { buildMapOverlaysFetchKey } from "./map-overlays.service";
import type { MapBounds } from "./map-overlays.types";
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
  const scannerMarketsViewportBounds = shallowRef<MapBounds | null>(null);
  const scannerMarketsViewportKey = shallowRef<string | null>(null);
  const scannerMarketsTask = useDebouncedLatestEffectTask({
    debounceMs: SCANNER_MARKETS_REFRESH_DEBOUNCE_MS,
    onClear() {
      scannerMarketsLastFetchKey = null;
      scannerMarketsViewportBounds.value = null;
      scannerMarketsViewportKey.value = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
    },
    onDispose() {
      scannerMarketsLastFetchKey = null;
      scannerMarketsViewportBounds.value = null;
      scannerMarketsViewportKey.value = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
    },
    onUnexpectedError(error) {
      scannerMarketsLastFetchKey = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary(
        "Market selection is unavailable."
      );
      console.error("[map] scanner markets refresh failed", error);
    },
  });
  let scannerMarketsLastFetchKey: string | null = null;
  let unsubscribeInteractionCoordinator: (() => void) | null = null;

  function logScannerMarketsError(context: string, error: unknown): void {
    console.error(`[map] scanner markets ${context} failed`, error);
  }

  async function clearScannerMarketsState(): Promise<void> {
    await scannerMarketsTask.clear();
  }

  function resolveScannerMarketsBounds(): MapBounds | null {
    if (scannerMarketsViewportBounds.value !== null) {
      return scannerMarketsViewportBounds.value;
    }

    const currentMap = options.map.value;
    if (currentMap === null) {
      return null;
    }

    const bounds = currentMap.getBounds();
    return {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    };
  }

  function startScannerMarketsRefresh(): ReturnType<typeof buildScannerMarketsRequest> {
    if (!options.scannerFetchEnabled.value) {
      scannerMarketsLastFetchKey = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
      return null;
    }

    const mapBounds = resolveScannerMarketsBounds();
    if (mapBounds === null) {
      scannerMarketsLastFetchKey = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
      return null;
    }

    const fetchKey = buildMapOverlaysFetchKey(mapBounds, "markets");
    if (fetchKey === scannerMarketsLastFetchKey) {
      return null;
    }

    const request = buildScannerMarketsRequest(mapBounds);
    if (request === null) {
      scannerMarketsLastFetchKey = fetchKey;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary(
        "Market overlap is unavailable for wrapped viewport bounds."
      );
      return null;
    }

    scannerMarketsLastFetchKey = fetchKey;
    return request;
  }

  function applyFailedScannerMarketsFetch(error: ApiEffectError): void {
    if (error instanceof ApiAbortedError) {
      return;
    }

    scannerMarketsLastFetchKey = null;
    scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary(
      getApiErrorMessage(error, "Market selection is unavailable.")
    );
  }

  function refreshScannerMarketsEffect(): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const stopRefreshTimer = createAppPerformanceTimer("scanner.markets.refresh.time");
      const request = startScannerMarketsRefresh();
      if (request === null) {
        stopRefreshTimer();
        return;
      }

      recordAppPerformanceCounter("scanner.markets.request.started");

      yield* fetchMarketsBySelectionEffect(request).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            scannerMarketSelection.value = buildScannerMarketSelectionSummary(result.data);
            recordAppPerformanceCounter("scanner.markets.request.succeeded");
            stopRefreshTimer();
          })
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            applyFailedScannerMarketsFetch(error);
            recordAppPerformanceCounter("scanner.markets.request.failed");
            stopRefreshTimer();
          })
        )
      );
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          logScannerMarketsError("refresh", error);
        })
      )
    );
  }

  function scheduleScannerMarketsRefresh(): void {
    if (!options.scannerFetchEnabled.value) {
      clearScannerMarketsState().catch((error: unknown) => {
        logScannerMarketsError("clear", error);
      });
      return;
    }

    scannerMarketsTask.start(refreshScannerMarketsEffect()).catch((error: unknown) => {
      logScannerMarketsError("schedule", error);
    });
  }

  const onMapMoveEnd = (): void => {
    recordAppPerformanceCounter("map.moveend", { feature: "scanner-markets" });
    scheduleScannerMarketsRefresh();
  };

  watch(
    [
      () => options.interactionCoordinator.value,
      options.scannerFetchEnabled,
      () => options.map.value,
    ],
    ([nextCoordinator, nextScannerFetchEnabled, currentMap]) => {
      unsubscribeInteractionCoordinator?.();
      unsubscribeInteractionCoordinator = null;

      if (!(nextScannerFetchEnabled && currentMap !== null && nextCoordinator !== null)) {
        return;
      }

      unsubscribeInteractionCoordinator = nextCoordinator.subscribe(
        (snapshot) => {
          if (!shouldRefreshViewportData(snapshot)) {
            return;
          }

          if (scannerMarketsViewportKey.value === snapshot.canonicalViewportKey) {
            return;
          }

          scannerMarketsViewportBounds.value = snapshot.quantizedBbox;
          scannerMarketsViewportKey.value = snapshot.canonicalViewportKey;
          onMapMoveEnd();
        },
        { emitCurrent: true, priority: "background" }
      );
    },
    { immediate: true }
  );

  watch(
    [options.scannerFetchEnabled, () => options.map.value],
    ([nextScannerFetchEnabled, currentMap]) => {
      if (!(nextScannerFetchEnabled && currentMap !== null)) {
        clearScannerMarketsState().catch((error: unknown) => {
          logScannerMarketsError("clear", error);
        });
        return;
      }

      scannerMarketsLastFetchKey = null;
      if (options.interactionCoordinator.value !== null) {
        return;
      }

      scheduleScannerMarketsRefresh();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    scannerMarketsTask.dispose().catch((error: unknown) => {
      logScannerMarketsError("dispose", error);
    });
    unsubscribeInteractionCoordinator?.();
    unsubscribeInteractionCoordinator = null;
  });

  return {
    scannerMarketSelection,
  };
}
