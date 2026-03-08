import type { ParcelEnrichRequest, ParcelsFeatureCollection } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import { Either, Effect } from "effect";
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
  fetchSpatialAnalysisParcelsPagesEffect,
  type SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";
import {
  ApiAbortedError,
  type ApiEffectError,
  ApiIngestionRunMismatchError,
  ApiPolicyRejectedError,
  getApiErrorReason,
} from "@/lib/effect/errors";
import { createDebouncedLatestRunner } from "@/lib/effect/debounced-latest-runner";
import type { BrowserEffectFiber } from "@/lib/effect/runtime";
import { forkScopedBrowserEffect, interruptBrowserFiber } from "@/lib/effect/runtime";
import { listenToMapEvent } from "@/lib/effect/scoped-listener";
import { mutateVueState } from "@/lib/effect/vue-bridge";

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
  const scannerParcelsRunner = createDebouncedLatestRunner({
    debounceMs: SCANNER_PARCELS_REFRESH_DEBOUNCE_MS,
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

  function resetScannerParcelsSelection(): void {
    isScannerParcelsLoading.value = false;
    scannerParcelsError.value = null;
    scannerParcelFeatures.value = [];
    scannerParcelTruncated.value = false;
    scannerParcelNextCursor.value = null;
  }

  async function clearScannerParcelsState(): Promise<void> {
    await scannerParcelsRunner.interrupt();
    resetScannerParcelsSelection();
    scannerParcelsBlockedReason.value = null;
    scannerParcelsLastFetchKey = null;
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
    return Effect.gen(function* () {
      const request = createScannerBboxRequest(scope.mapBounds);
      const result = yield* Effect.either(
        fetchSpatialAnalysisParcelsPagesEffect({
          expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
          request,
          cursorRepeatLogContext: "scanner-viewport",
        })
      );

      if (Either.isRight(result)) {
        return result.right;
      }

      if (!(result.left instanceof ApiPolicyRejectedError)) {
        yield* Effect.fail(result.left);
      }

      return yield* fetchSpatialAnalysisParcelsPagesEffect({
        expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
        request: createScannerBboxRequest(buildCenterLimitedBbox(scope.mapBounds)),
        cursorRepeatLogContext: "scanner-fallback-bbox",
      });
    });
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
        const anchorResult = yield* Effect.either(
          fetchSpatialAnalysisParcelsPagesEffect({
            expectedIngestionRunId: options.expectedParcelsIngestionRunId.value,
            request: anchorRequest,
            cursorRepeatLogContext: "scanner-anchor-bbox",
          })
        );

        if (Either.isLeft(anchorResult)) {
          if (anchorResult.left instanceof ApiAbortedError) {
            yield* Effect.fail(anchorResult.left);
          }

          continue;
        }

        appendScannerAnchorFeatures(accumulator.parcelById, anchorResult.right.features);
        accumulator.truncated = accumulator.truncated || anchorResult.right.truncated;
        accumulator.nextCursor = mergeScannerAnchorCursor(
          accumulator.nextCursor,
          anchorResult.right.nextCursor
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
      "_tag" in error ? `Parcels query failed (${getApiErrorReason(error)}).` : "Parcels query failed (unexpected).";
    scannerParcelFeatures.value = [];
    scannerParcelTruncated.value = false;
    scannerParcelNextCursor.value = null;
    scannerParcelsLastFetchKey = null;
    console.error("[map] scanner parcels viewport query failed", error);
  }

  function refreshScannerParcelsEffect(): Effect.Effect<void, ApiEffectError, never> {
    return Effect.gen(function* () {
      const scope = yield* mutateVueState(() => startScannerParcelsRefresh());
      if (scope === null) {
        return;
      }

      const result = yield* Effect.either(fetchScannerParcelsFromBboxEffect(scope));
      yield* mutateVueState(() => {
        isScannerParcelsLoading.value = false;
      });

      if (Either.isLeft(result)) {
        if (typeof result.left === "undefined") {
          throw new Error("fetchScannerParcelsFromBboxEffect returned an undefined failure.");
        }
        if (!(result.left instanceof Error)) {
          throw new Error("fetchScannerParcelsFromBboxEffect returned a non-error failure.");
        }

        yield* mutateVueState(() => {
          applyFailedScannerParcelsFetch(result.left);
        });
        return;
      }

      const initialSelection: ScannerParcelsSelection = {
        features: result.right.features,
        truncated: result.right.truncated,
        nextCursor: result.right.nextCursor,
      };
      const selection = yield* enrichScannerSelectionWithAnchorsEffect({
        selection: initialSelection,
        nextCursor: result.right.nextCursor,
      });

      yield* mutateVueState(() => {
        scannerParcelsBlockedReason.value = null;
        scannerParcelFeatures.value = selection.features;
        scannerParcelTruncated.value = selection.truncated;
        scannerParcelNextCursor.value = selection.nextCursor;
      });
    });
  }

  function scheduleScannerParcelsRefresh(): void {
    if (!options.scannerFetchEnabled.value) {
      void clearScannerParcelsState();
      return;
    }

    void scannerParcelsRunner.run(refreshScannerParcelsEffect());
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
      void bindMoveendMap(nextMap);
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
        void clearScannerParcelsState();
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
        void clearScannerParcelsState();
        return;
      }

      scannerParcelsLastFetchKey = null;
      scheduleScannerParcelsRefresh();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    void scannerParcelsRunner.dispose();
    void bindMoveendMap(null);
    resetScannerParcelsSelection();
    scannerParcelsBlockedReason.value = null;
    scannerParcelsLastFetchKey = null;
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
