import type { ApiEffectError } from "@map-migration/core-runtime/api";
import { ApiAbortedError, getApiErrorMessage } from "@map-migration/core-runtime/api";
import type { BrowserEffectFiber } from "@map-migration/core-runtime/browser";
import {
  forkScopedBrowserEffect,
  interruptBrowserFiber,
} from "@map-migration/core-runtime/browser";
import type { IMap } from "@map-migration/map-engine";
import { Effect, Either } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { fetchMarketsBySelectionEffect } from "@/features/selection-tool/selection-tool.api";
import { createDebouncedLatestRunner } from "@/lib/effect/debounced-latest-runner";
import { listenToMapEvent } from "@/lib/effect/scoped-listener";
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
  const scannerMarketsRunner = createDebouncedLatestRunner({
    debounceMs: SCANNER_MARKETS_REFRESH_DEBOUNCE_MS,
    onUnexpectedError(error) {
      scannerMarketsLastFetchKey = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary(
        "Market selection is unavailable."
      );
      console.error("[map] scanner markets refresh failed", error);
    },
  });
  let scannerMarketsLastFetchKey: string | null = null;
  let moveendListenerFiber: BrowserEffectFiber<void, never> | null = null;

  function logScannerMarketsError(context: string, error: unknown): void {
    console.error(`[map] scanner markets ${context} failed`, error);
  }

  async function clearScannerMarketsState(): Promise<void> {
    await scannerMarketsRunner.interrupt();
    scannerMarketsLastFetchKey = null;
    scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
  }

  function startScannerMarketsRefresh(): ReturnType<typeof buildScannerMarketsRequest> {
    const currentMap = options.map.value;
    if (currentMap === null || !options.scannerFetchEnabled.value) {
      scannerMarketsLastFetchKey = null;
      scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
      return null;
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
      const request = startScannerMarketsRefresh();
      if (request === null) {
        return;
      }

      const result = yield* Effect.either(fetchMarketsBySelectionEffect(request));
      if (Either.isRight(result)) {
        scannerMarketSelection.value = buildScannerMarketSelectionSummary(result.right.data);
        return;
      }

      applyFailedScannerMarketsFetch(result.left);
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

    scannerMarketsRunner.run(refreshScannerMarketsEffect()).catch((error: unknown) => {
      logScannerMarketsError("schedule", error);
    });
  }

  const onMapMoveEnd = (): void => {
    scheduleScannerMarketsRefresh();
  };

  async function bindMoveendMap(nextMap: IMap | null): Promise<void> {
    await interruptBrowserFiber(moveendListenerFiber);
    moveendListenerFiber = null;

    if (nextMap === null) {
      return;
    }

    moveendListenerFiber = forkScopedBrowserEffect(
      Effect.gen(function* () {
        yield* listenToMapEvent(nextMap, "moveend", onMapMoveEnd);
        yield* Effect.never;
      })
    );
  }

  watch(
    () => options.map.value,
    (nextMap) => {
      bindMoveendMap(nextMap).catch((error: unknown) => {
        logScannerMarketsError("bind moveend", error);
      });
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
      scheduleScannerMarketsRefresh();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    scannerMarketsRunner.dispose().catch((error: unknown) => {
      logScannerMarketsError("dispose", error);
    });
    bindMoveendMap(null).catch((error: unknown) => {
      logScannerMarketsError("unbind moveend", error);
    });
    scannerMarketsLastFetchKey = null;
    scannerMarketSelection.value = buildEmptyScannerMarketSelectionSummary();
  });

  return {
    scannerMarketSelection,
  };
}
