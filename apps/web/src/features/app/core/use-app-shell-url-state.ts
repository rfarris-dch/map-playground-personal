import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDebouncedLatestEffectTask } from "@/composables/use-debounced-latest-effect-task";
import {
  createAppPerformanceTimer,
  recordAppPerformanceCounter,
} from "@/features/app/diagnostics/app-performance.service";
import { shouldRefreshViewportData } from "@/features/app/interaction/map-interaction-policy.service";
import {
  applyMapContextTransferToAppShell,
  readMapContextTransferFromRoute,
  readMapContextTransferTokenFromQuery,
} from "@/features/map-context-transfer/map-context-transfer.service";
import {
  buildAppShellUrlStateQuery,
  createSelfAuthoredQuerySignatureRegistry,
  serializeNormalizedMapContextQuery,
} from "./app-shell-url-state.service";
import type { UseAppShellUrlStateOptions } from "./app-shell-url-state.types";

function normalizeViewportForMap(
  viewport: NonNullable<MapContextTransfer["viewport"]>
): import("@map-migration/map-engine").MapViewport {
  if (viewport.type === "bounds") {
    return {
      ...(typeof viewport.bearing === "number" ? { bearing: viewport.bearing } : {}),
      bounds: viewport.bounds,
      ...(typeof viewport.pitch === "number" ? { pitch: viewport.pitch } : {}),
      type: "bounds",
    };
  }

  return {
    ...(typeof viewport.bearing === "number" ? { bearing: viewport.bearing } : {}),
    center: viewport.center,
    ...(typeof viewport.pitch === "number" ? { pitch: viewport.pitch } : {}),
    type: "center",
    zoom: viewport.zoom,
  };
}

const URL_STATE_SYNC_DEBOUNCE_MS = 180;

export function useAppShellUrlState(options: UseAppShellUrlStateOptions): void {
  const route = useRoute();
  const router = useRouter();
  const contextToken = shallowRef<string | null>(
    readMapContextTransferTokenFromQuery(route.query) ?? null
  );
  const lastViewportKey = shallowRef<string | null>(null);
  const viewportVersion = shallowRef(0);
  const selfAuthoredQuerySignatures = createSelfAuthoredQuerySignatureRegistry();
  const replaceTask = useDebouncedLatestEffectTask({
    debounceMs: URL_STATE_SYNC_DEBOUNCE_MS,
    onUnexpectedError(error) {
      console.error("[map] url state sync failed", error);
    },
  });

  function syncRouteToUrlState(): Promise<void> {
    const stopSyncTimer = createAppPerformanceTimer("url-state.sync.time");
    if (options.map.value === null) {
      stopSyncTimer();
      return Promise.resolve();
    }

    const nextQuery = buildAppShellUrlStateQuery(
      options,
      route.query,
      contextToken.value ?? undefined
    );
    const nextSignature = serializeNormalizedMapContextQuery(nextQuery);
    const currentSignature = serializeNormalizedMapContextQuery(route.query);

    contextToken.value = readMapContextTransferTokenFromQuery(nextQuery) ?? null;

    if (currentSignature === nextSignature) {
      selfAuthoredQuerySignatures.clear(nextSignature);
      stopSyncTimer();
      return Promise.resolve();
    }

    if (selfAuthoredQuerySignatures.has(nextSignature)) {
      stopSyncTimer();
      return Promise.resolve();
    }

    selfAuthoredQuerySignatures.add(nextSignature);

    return replaceTask.start(
      Effect.tryPromise({
        try: async () => {
          await router.replace({ query: nextQuery });
          stopSyncTimer();
        },
        catch: (error) => {
          selfAuthoredQuerySignatures.clear(nextSignature);
          stopSyncTimer();
          throw error;
        },
      })
    );
  }

  watch(
    () => serializeNormalizedMapContextQuery(route.query),
    (routeQuerySignature) => {
      contextToken.value = readMapContextTransferTokenFromQuery(route.query) ?? null;
      if (selfAuthoredQuerySignatures.consume(routeQuerySignature)) {
        return;
      }

      const mapContext = readMapContextTransferFromRoute({ route });
      applyMapContextTransferToAppShell({
        context: mapContext,
        setBasemapLayerVisible: options.setBasemapLayerVisible,
        setBoundarySelectedRegionIds: options.setBoundarySelectedRegionIds,
        setBoundaryVisible: options.setBoundaryVisible,
        setCountyPowerStoryAnimationEnabled: options.setCountyPowerStoryAnimationEnabled,
        setCountyPowerStoryChapterId: options.setCountyPowerStoryChapterId,
        setCountyPowerStoryChapterVisible: options.setCountyPowerStoryChapterVisible,
        setCountyPowerStorySeamHazeEnabled: options.setCountyPowerStorySeamHazeEnabled,
        setCountyPowerStoryStoryId: options.setCountyPowerStoryStoryId,
        setCountyPowerStoryThreeDimensionalEnabled:
          options.setCountyPowerStoryThreeDimensionalEnabled,
        setCountyPowerStoryVisible: options.setCountyPowerStoryVisible,
        setCountyPowerStoryWindow: options.setCountyPowerStoryWindow,
        setFiberLayerVisibility: options.setFiberLayerVisibility,
        setFiberSourceLayerSelection: options.setFiberSourceLayerSelection,
        setFloodLayerVisible: options.setFloodLayerVisible,
        setGasPipelineVisible: options.setGasPipelineVisible,
        setHydroBasinsVisible: options.setHydroBasinsVisible,
        setMapViewport: (viewport) => {
          options.map.value?.setViewport(normalizeViewportForMap(viewport));
        },
        setParcelsVisible: options.setParcelsVisible,
        setPerspectiveViewMode: options.setPerspectiveViewMode,
        setPerspectiveVisibility: options.setPerspectiveVisibility,
        setPowerLayerVisible: options.setPowerLayerVisible,
        setMapFiltersState: options.setMapFiltersState,
        setWaterVisible: options.setWaterVisible,
      });
    },
    { immediate: true }
  );

  watch(
    () => options.map.value,
    (map, previousMap) => {
      if (previousMap === map || map === null) {
        return;
      }

      const initialMapContext = readMapContextTransferFromRoute({ route });
      if (typeof initialMapContext?.viewport !== "undefined") {
        map.setViewport(normalizeViewportForMap(initialMapContext.viewport));
      }
    },
    { immediate: true }
  );

  watch(
    () => options.interactionCoordinator.value,
    (nextCoordinator, _previousCoordinator, onCleanup) => {
      const unsubscribeInteractionCoordinator = nextCoordinator?.subscribe(
        (snapshot) => {
          if (!shouldRefreshViewportData(snapshot)) {
            return;
          }

          // The initial load snapshot reflects the current route state; writing it
          // straight back to the router only adds startup churn.
          if (lastViewportKey.value === null && snapshot.eventType === "load") {
            lastViewportKey.value = snapshot.canonicalViewportKey;
            return;
          }

          if (lastViewportKey.value === snapshot.canonicalViewportKey) {
            return;
          }

          lastViewportKey.value = snapshot.canonicalViewportKey;
          recordAppPerformanceCounter("map.moveend", { feature: "url-state" });
          viewportVersion.value += 1;
        },
        { priority: "idle" }
      );

      onCleanup(() => {
        unsubscribeInteractionCoordinator?.();
      });
    },
    { immediate: true }
  );

  watch(
    () => [
      options.currentSurface.value,
      options.basemapVisibility.value,
      options.boundaryFacetSelection.value,
      options.boundaryVisibility.value,
      options.countyPowerStoryVisibility.value,
      options.fiberVisibility.value,
      options.floodVisibility.value,
      options.gasPipelineVisible.value,
      options.hydroBasinsVisible.value,
      options.layerRuntimeSnapshot.value,
      options.parcelsVisible.value,
      options.perspectiveViewModes.value,
      options.powerVisibility.value,
      options.selectedFiberSourceLayerNames.value,
      options.visiblePerspectives.value,
      viewportVersion.value,
      options.waterVisible.value,
      options.mapFilters.value,
    ],
    () => {
      syncRouteToUrlState().catch(() => undefined);
    },
    { deep: true }
  );

  onBeforeUnmount(() => {
    replaceTask.dispose().catch(() => undefined);
  });
}
