import {
  type ScopedEffectHandle,
  startBrowserScopedEffect,
} from "@map-migration/core-runtime/browser";
import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import type { MapViewport } from "@map-migration/map-engine";
import {
  destroyBoundaryRuntime,
  initializeBoundaryRuntime,
  resetBoundaryRuntime,
} from "@/features/app/boundary/app-shell-boundary-runtime.service";
import { createMapInteractionCoordinator } from "@/features/app/interaction/map-interaction.service";
import {
  AppShellMapInitError,
  type AppShellMapSetup,
  initializeAppShellMapEffect,
} from "@/features/app/lifecycle/app-shell-map.service";
import {
  destroyMapLayerRuntime,
  initializeMapLayerRuntime,
} from "@/features/app/lifecycle/app-shell-map-layer-runtime.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import {
  destroyMarketBoundaryRuntime,
  initializeMarketBoundaryRuntime,
  resetMarketBoundaryRuntime,
} from "@/features/app/market-boundary/app-shell-market-boundary-runtime.service";
import { createLayerRuntime } from "@/features/layers/layer-runtime.service";

function toMapViewport(viewport: MapContextTransfer["viewport"] | undefined): MapViewport | null {
  if (typeof viewport === "undefined") {
    return null;
  }

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

export async function initializeMapLifecycleRuntime(
  options: UseAppShellMapLifecycleOptions
): Promise<void> {
  const container = options.runtime.mapContainer.value;
  if (container === null) {
    return;
  }

  options.runtime.mapInitStatus.value = { phase: "initializing", errorReason: null };

  let mapSetup: ScopedEffectHandle<AppShellMapSetup>;
  try {
    mapSetup = await startBrowserScopedEffect<AppShellMapSetup, AppShellMapInitError>(
      initializeAppShellMapEffect(container, {
        initialViewport: options.initialViewport,
      })
    );
  } catch (error: unknown) {
    const reason = error instanceof AppShellMapInitError ? error.reason : "unknown";
    console.error("[map] initialization failed", { reason, error });
    options.runtime.mapInitStatus.value = { phase: "error", errorReason: reason };
    return;
  }

  options.runtime.disposeMapRuntime.value = mapSetup.dispose;
  options.runtime.map.value = mapSetup.value.map;
  const initialViewport = toMapViewport(options.initialViewport);
  if (initialViewport !== null) {
    mapSetup.value.map.setViewport(initialViewport);
  }
  options.runtime.interactionCoordinator.value = createMapInteractionCoordinator(
    mapSetup.value.map
  );
  options.runtime.layerRuntime.value = createLayerRuntime(mapSetup.value.map, {
    initialUserVisibleLayerIds: options.readInitialUserVisibleLayerIds(),
    interactionCoordinator: options.runtime.interactionCoordinator.value,
    onSnapshot: (snapshot) => {
      options.state.layerRuntimeSnapshot.value = snapshot;
    },
  });
  options.runtime.basemapLayerController.value = mapSetup.value.basemapLayerController;
  options.visibility.applyBasemapVisibility();

  initializeBoundaryRuntime(options);
  initializeMarketBoundaryRuntime(options);
  initializeMapLayerRuntime(options);
  options.visibility.syncRuntimeVisibility();

  options.runtime.mapInitStatus.value = { phase: "ready", errorReason: null };
}

export function resetMapLifecycleInteractions(options: UseAppShellMapLifecycleOptions): void {
  options.actions.clearSelectedCountyPowerStory();
  options.actions.clearSelectedFacility();
  options.actions.clearSelectedParcel();
  options.layers.countyPowerStoryController.value?.controller.setSelectedCounty(null);
  options.state.hoveredCountyPowerStory.value = null;
  options.layers.facilitiesHoverController.value?.clear();
  options.state.hoveredFacility.value = null;
  options.state.hoveredFacilityCluster.value = null;
  resetBoundaryRuntime(options);
  resetMarketBoundaryRuntime(options);
  options.layers.powerHoverController.value?.clear();
  options.state.hoveredPower.value = null;
  options.fiber.clearFiberHover();
}

export async function destroyMapLifecycleRuntime(
  options: UseAppShellMapLifecycleOptions
): Promise<void> {
  options.runtime.basemapLayerController.value = null;

  destroyMapLayerRuntime(options);
  destroyMarketBoundaryRuntime(options);
  destroyBoundaryRuntime(options);

  options.runtime.interactionCoordinator.value?.destroy();
  options.runtime.interactionCoordinator.value = null;
  options.runtime.layerRuntime.value?.destroy();
  options.runtime.layerRuntime.value = null;
  options.state.layerRuntimeSnapshot.value = null;
  const disposeMapRuntime = options.runtime.disposeMapRuntime.value;
  options.runtime.disposeMapRuntime.value = null;
  await disposeMapRuntime?.();
  options.runtime.map.value = null;
}
