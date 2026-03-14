import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  applyMapContextTransferToAppShell,
  readMapContextTransferFromRoute,
  readMapContextTransferTokenFromQuery,
} from "@/features/map-context-transfer/map-context-transfer.service";
import { createLatestRunner } from "@/lib/effect/latest-runner";
import {
  buildAppShellUrlStateQuery,
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

export function useAppShellUrlState(options: UseAppShellUrlStateOptions): void {
  const route = useRoute();
  const router = useRouter();
  const contextToken = shallowRef<string | null>(
    readMapContextTransferTokenFromQuery(route.query) ?? null
  );
  const lastWrittenQuerySignature = shallowRef<string | null>(null);
  const viewportVersion = shallowRef(0);
  const replaceRunner = createLatestRunner({
    onUnexpectedError: (error) => {
      console.error("[map] url state sync failed", error);
    },
  });

  function syncRouteToUrlState(): Promise<void> {
    if (options.map.value === null) {
      return Promise.resolve();
    }

    const nextQuery = buildAppShellUrlStateQuery(
      options,
      route.query,
      contextToken.value ?? undefined
    );
    const nextSignature = serializeNormalizedMapContextQuery(nextQuery);
    contextToken.value = readMapContextTransferTokenFromQuery(nextQuery) ?? null;
    lastWrittenQuerySignature.value = nextSignature;

    return replaceRunner.run(
      Effect.sync(() => {
        if (typeof window === "undefined") {
          return;
        }

        const nextHref = router.resolve({ query: nextQuery }).fullPath;
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentHref === nextHref) {
          return;
        }

        window.history.replaceState(window.history.state, "", nextHref);
      })
    );
  }

  watch(
    () => serializeNormalizedMapContextQuery(route.query),
    (routeQuerySignature) => {
      contextToken.value = readMapContextTransferTokenFromQuery(route.query) ?? null;

      if (routeQuerySignature === lastWrittenQuerySignature.value) {
        lastWrittenQuerySignature.value = null;
        return;
      }

      const mapContext = readMapContextTransferFromRoute({ route });
      applyMapContextTransferToAppShell({
        context: mapContext,
        setBasemapLayerVisible: options.setBasemapLayerVisible,
        setBoundarySelectedRegionIds: options.setBoundarySelectedRegionIds,
        setBoundaryVisible: options.setBoundaryVisible,
        setFiberLayerVisibility: options.setFiberLayerVisibility,
        setFiberSourceLayerSelection: options.setFiberSourceLayerSelection,
        setFloodLayerVisible: options.setFloodLayerVisible,
        setHydroBasinsVisible: options.setHydroBasinsVisible,
        setMapViewport: (viewport) => {
          options.map.value?.setViewport(normalizeViewportForMap(viewport));
        },
        setParcelsVisible: options.setParcelsVisible,
        setPerspectiveVisibility: options.setPerspectiveVisibility,
        setPowerLayerVisible: options.setPowerLayerVisible,
        setWaterVisible: options.setWaterVisible,
      });
    },
    { immediate: true }
  );

  watch(
    () => options.map.value,
    (map, previousMap, onCleanup) => {
      if (previousMap === map || map === null) {
        return;
      }

      const initialMapContext = readMapContextTransferFromRoute({ route });
      if (typeof initialMapContext?.viewport !== "undefined") {
        map.setViewport(normalizeViewportForMap(initialMapContext.viewport));
      }

      const onMoveEnd = (): void => {
        viewportVersion.value += 1;
      };

      map.on("moveend", onMoveEnd);
      onCleanup(() => {
        map.off("moveend", onMoveEnd);
      });

      syncRouteToUrlState().catch(() => undefined);
    },
    { immediate: true }
  );

  watch(
    () => [
      options.currentSurface.value,
      options.basemapVisibility.value,
      options.boundaryFacetSelection.value,
      options.boundaryVisibility.value,
      options.fiberVisibility.value,
      options.floodVisibility.value,
      options.hydroBasinsVisible.value,
      options.layerRuntimeSnapshot.value,
      options.parcelsVisible.value,
      options.powerVisibility.value,
      options.selectedFiberSourceLayerNames.value,
      options.visiblePerspectives.value,
      viewportVersion.value,
      options.waterVisible.value,
    ],
    () => {
      syncRouteToUrlState().catch(() => undefined);
    },
    { deep: true }
  );

  onBeforeUnmount(() => {
    replaceRunner.dispose().catch(() => undefined);
  });
}
