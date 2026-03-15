import {
  ApiAbortedError,
  type ApiEffectError,
  getApiErrorReason,
} from "@map-migration/core-runtime/api";
import type { BrowserEffectFiber } from "@map-migration/core-runtime/browser";
import {
  forkScopedBrowserEffect,
  interruptBrowserFiber,
} from "@map-migration/core-runtime/browser";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import type { IMap } from "@map-migration/map-engine";
import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useDebouncedLatestEffectTask } from "@/composables/use-debounced-latest-effect-task";
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
  type ApiIngestionRunMismatchError,
  fetchSpatialAnalysisParcelsPagesEffect,
  type SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";
import { listenToMapEvent } from "@/lib/effect/scoped-listener";

const SCANNER_PARCELS_REFRESH_DEBOUNCE_MS = 260;
const SCANNER_PARCELS_MAX_BBOX_WIDTH_DEGREES = 2;
const SCANNER_PARCELS_MAX_BBOX_HEIGHT_DEGREES = 2;

type ScannerParcelsPagesSuccess = Extract<SpatialAnalysisParcelsPagesResult, { ok: true }>;

function normalizeEastLongitude(mapBounds: ScannerParcelsRefreshScope["mapBounds"]): number {
  if (mapBounds.east >= mapBounds.west) {
    return mapBounds.east;
  }

  return mapBounds.east + 360;
}

function mapBoundsExceedParcelApiLimits(
  mapBounds: ScannerParcelsRefreshScope["mapBounds"]
): boolean {
  const width = normalizeEastLongitude(mapBounds) - mapBounds.west;
  const height = mapBounds.north - mapBounds.south;
  return (
    width > SCANNER_PARCELS_MAX_BBOX_WIDTH_DEGREES ||
    height > SCANNER_PARCELS_MAX_BBOX_HEIGHT_DEGREES
  );
}

export function useMapOverlaysScannerParcels(options: UseMapOverlaysScannerParcelsOptions) {
  const scannerParcelFeatures = shallowRef<ParcelsFeatureCollection["features"]>([]);
  const scannerParcelTruncated = shallowRef<boolean>(false);
  const scannerParcelNextCursor = shallowRef<string | null>(null);
  const scannerParcelsBlockedReason = shallowRef<string | null>(null);
  const scannerParcelsError = shallowRef<string | null>(null);
  const isScannerParcelsLoading = shallowRef<boolean>(false);
  const scannerParcelsTask = useDebouncedLatestEffectTask({
    debounceMs: SCANNER_PARCELS_REFRESH_DEBOUNCE_MS,
    onClear() {
      resetScannerParcelsSelection();
      scannerParcelsBlockedReason.value = null;
      scannerParcelsLastFetchKey = null;
    },
    onDispose() {
      resetScannerParcelsSelection();
      scannerParcelsBlockedReason.value = null;
      scannerParcelsLastFetchKey = null;
    },
    onUnexpectedError(error) {
      isScannerParcelsLoading.value = false;
      scannerParcelsBlockedReason.value = null;
      scannerParcelsError.value = "Parcels query failed (unexpected).";
      scannerParcelsLastFetchKey = null;
      console.error("[map] scanner parcels refresh failed", error);
    },
  });
  let moveendListenerFiber: BrowserEffectFiber<void, never> | null = null;
  let scannerParcelsLastFetchKey: string | null = null;

  function logScannerParcelsError(context: string, error: unknown): void {
    console.error(`[map] scanner parcels ${context} failed`, error);
  }

  function resetScannerParcelsSelection(): void {
    isScannerParcelsLoading.value = false;
    scannerParcelsError.value = null;
    scannerParcelFeatures.value = [];
    scannerParcelTruncated.value = false;
    scannerParcelNextCursor.value = null;
  }

  async function clearScannerParcelsState(): Promise<void> {
    await scannerParcelsTask.clear();
  }

  function startScannerParcelsRefresh(): ScannerParcelsRefreshScope | null {
    const currentMap = options.map.value;
    if (currentMap === null || !options.scannerFetchEnabled.value) {
      resetScannerParcelsSelection();
      scannerParcelsBlockedReason.value = null;
      scannerParcelsLastFetchKey = null;
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

    if (mapBoundsExceedParcelApiLimits(mapBounds)) {
      resetScannerParcelsSelection();
      scannerParcelsBlockedReason.value = "Zoom in to load parcels in the current viewport.";
      scannerParcelsLastFetchKey = fetchKey;
      return null;
    }

    scannerParcelsBlockedReason.value = null;
    scannerParcelsLastFetchKey = fetchKey;
    isScannerParcelsLoading.value = true;
    scannerParcelsError.value = null;

    return {
      mapBounds,
    };
  }

  function fetchScannerParcelsFromBboxEffect(
    scope: ScannerParcelsRefreshScope
  ): Effect.Effect<
    ScannerParcelsPagesSuccess,
    ApiEffectError | ApiIngestionRunMismatchError,
    never
  > {
    const request = createScannerBboxRequest(scope.mapBounds);
    return fetchSpatialAnalysisParcelsPagesEffect({
      expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
      request,
      cursorRepeatLogContext: "scanner-viewport",
    }).pipe(
      Effect.catchIf(
        (error) => error._tag === "ApiHttpError" && error.code === "POLICY_REJECTED",
        () =>
          fetchSpatialAnalysisParcelsPagesEffect({
            expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
            request: createScannerBboxRequest(buildCenterLimitedBbox(scope.mapBounds)),
            cursorRepeatLogContext: "scanner-fallback-bbox",
          })
      )
    );
  }

  function buildScannerAnchorRequests(): readonly ParcelEnrichRequest[] {
    return createScannerAnchorRequests({
      buildFacilityAnchorParcelRequests,
      colocationFeatures: options.colocationViewportFeatures.value,
      hyperscaleFeatures: options.hyperscaleViewportFeatures.value,
    });
  }

  function fetchScannerAnchorSelectionEffect(
    selectionArgs: ScannerAnchorSelectionArgs
  ): Effect.Effect<ScannerParcelsSelection, ApiAbortedError, never> {
    return Effect.gen(function* () {
      const accumulator = createScannerAnchorAccumulator({
        selection: selectionArgs.selection,
        nextCursor: selectionArgs.nextCursor,
      });

      for (const anchorRequest of selectionArgs.anchorRequests) {
        yield* fetchSpatialAnalysisParcelsPagesEffect({
          expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
          request: anchorRequest,
          cursorRepeatLogContext: "scanner-anchor-bbox",
        }).pipe(
          Effect.tap((anchorResult) =>
            Effect.sync(() => {
              appendScannerAnchorFeatures(accumulator.parcelById, anchorResult.features);
              accumulator.truncated = accumulator.truncated || anchorResult.truncated;
              accumulator.nextCursor = mergeScannerAnchorCursor(
                accumulator.nextCursor,
                anchorResult.nextCursor
              );
            })
          ),
          Effect.catchAll((error) => {
            if (error instanceof ApiAbortedError) {
              return Effect.fail(error);
            }
            return Effect.void;
          })
        );
      }

      return buildScannerSelectionFromAccumulator({
        selection: selectionArgs.selection,
        accumulator,
      });
    });
  }

  function enrichScannerSelectionWithAnchorsEffect(args: {
    readonly nextCursor: string | null;
    readonly selection: ScannerParcelsSelection;
  }): Effect.Effect<ScannerParcelsSelection, ApiAbortedError, never> {
    if (args.selection.features.length > 0) {
      return Effect.succeed(args.selection);
    }

    const anchorRequests = buildScannerAnchorRequests();
    if (anchorRequests.length === 0) {
      return Effect.succeed(args.selection);
    }

    return fetchScannerAnchorSelectionEffect({
      anchorRequests,
      selection: args.selection,
      nextCursor: args.nextCursor,
    });
  }

  function applyFailedScannerParcelsFetch(error: ApiEffectError | Error): void {
    if (error instanceof ApiAbortedError) {
      return;
    }

    scannerParcelsBlockedReason.value = null;
    scannerParcelsError.value =
      "_tag" in error
        ? `Parcels query failed (${getApiErrorReason(error)}).`
        : "Parcels query failed (unexpected).";
    scannerParcelFeatures.value = [];
    scannerParcelTruncated.value = false;
    scannerParcelNextCursor.value = null;
    scannerParcelsLastFetchKey = null;
    console.error("[map] scanner parcels viewport query failed", error);
  }

  function refreshScannerParcelsEffect(): Effect.Effect<void, ApiEffectError, never> {
    return Effect.gen(function* () {
      const scope = yield* Effect.sync(() => startScannerParcelsRefresh());
      if (scope === null) {
        return;
      }

      yield* fetchScannerParcelsFromBboxEffect(scope).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            isScannerParcelsLoading.value = false;
          })
        ),
        Effect.flatMap((result) => {
          const initialSelection: ScannerParcelsSelection = {
            features: result.features,
            truncated: result.truncated,
            nextCursor: result.nextCursor,
          };
          return enrichScannerSelectionWithAnchorsEffect({
            selection: initialSelection,
            nextCursor: result.nextCursor,
          });
        }),
        Effect.tap((selection) =>
          Effect.sync(() => {
            scannerParcelsBlockedReason.value = null;
            scannerParcelFeatures.value = selection.features;
            scannerParcelTruncated.value = selection.truncated;
            scannerParcelNextCursor.value = selection.nextCursor;
          })
        ),
        Effect.catchAll((error) => {
          isScannerParcelsLoading.value = false;

          if (typeof error === "undefined") {
            throw new Error("fetchScannerParcelsFromBboxEffect returned an undefined failure.");
          }
          if (!(error instanceof Error)) {
            throw new Error("fetchScannerParcelsFromBboxEffect returned a non-error failure.");
          }

          return Effect.sync(() => {
            applyFailedScannerParcelsFetch(error);
          });
        })
      );
    });
  }
  function scheduleScannerParcelsRefresh(): void {
    if (!options.scannerFetchEnabled.value) {
      clearScannerParcelsState().catch((error: unknown) => {
        logScannerParcelsError("clear", error);
      });
      return;
    }

    scannerParcelsTask.start(refreshScannerParcelsEffect()).catch((error: unknown) => {
      logScannerParcelsError("schedule", error);
    });
  }

  const onMapMoveEnd = (): void => {
    scheduleScannerParcelsRefresh();
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
        logScannerParcelsError("bind moveend", error);
      });
    },
    { immediate: true }
  );

  watch(
    [
      () => options.colocationViewportFeatures.value,
      () => options.hyperscaleViewportFeatures.value,
      () => options.expectedParcelsIngestionRunId.value,
      options.scannerFetchEnabled,
    ],
    ([, , , nextScannerFetchEnabled]) => {
      if (!nextScannerFetchEnabled) {
        clearScannerParcelsState().catch((error: unknown) => {
          logScannerParcelsError("clear", error);
        });
        return;
      }

      scannerParcelsLastFetchKey = null;
      scheduleScannerParcelsRefresh();
    },
    { immediate: false }
  );

  watch(
    [options.scannerFetchEnabled, () => options.map.value],
    ([nextScannerFetchEnabled, currentMap]) => {
      if (!(nextScannerFetchEnabled && currentMap !== null)) {
        clearScannerParcelsState().catch((error: unknown) => {
          logScannerParcelsError("clear", error);
        });
        return;
      }

      scannerParcelsLastFetchKey = null;
      scheduleScannerParcelsRefresh();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    scannerParcelsTask.dispose().catch((error: unknown) => {
      logScannerParcelsError("dispose", error);
    });
    bindMoveendMap(null).catch((error: unknown) => {
      logScannerParcelsError("unbind moveend", error);
    });
  });

  return {
    scannerParcelFeatures,
    scannerParcelTruncated,
    scannerParcelNextCursor,
    scannerParcelsBlockedReason,
    scannerParcelsError,
    isScannerParcelsLoading,
  };
}
