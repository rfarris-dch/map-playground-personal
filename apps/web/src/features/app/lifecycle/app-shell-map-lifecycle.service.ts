import { startBrowserScopedEffect } from "@map-migration/core-runtime/browser";
import {
  destroyBoundaryRuntime,
  initializeBoundaryRuntime,
  resetBoundaryRuntime,
} from "@/features/app/boundary/app-shell-boundary-runtime.service";
import {
  type AppShellMapSetup,
  initializeAppShellMapEffect,
} from "@/features/app/lifecycle/app-shell-map.service";
import {
  destroyMapLayerRuntime,
  initializeMapLayerRuntime,
} from "@/features/app/lifecycle/app-shell-map-layer-runtime.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { createLayerRuntime } from "@/features/layers/layer-runtime.service";

export async function initializeMapLifecycleRuntime(
  options: UseAppShellMapLifecycleOptions
): Promise<void> {
  const container = options.runtime.mapContainer.value;
  if (container === null) {
    return;
  }

  const mapSetup = await startBrowserScopedEffect<AppShellMapSetup, never>(
    initializeAppShellMapEffect(container, {
      initialViewport: options.initialViewport,
    })
  );
  options.runtime.disposeMapRuntime.value = mapSetup.dispose;
  options.runtime.map.value = mapSetup.value.map;
  options.runtime.layerRuntime.value = createLayerRuntime(mapSetup.value.map, {
    onSnapshot: (snapshot) => {
      options.state.layerRuntimeSnapshot.value = snapshot;
    },
  });
  options.runtime.basemapLayerController.value = mapSetup.value.basemapLayerController;
  options.visibility.applyBasemapVisibility();

  initializeBoundaryRuntime(options);
  initializeMapLayerRuntime(options);
  options.visibility.syncRuntimeVisibility();
}

export function resetMapLifecycleInteractions(options: UseAppShellMapLifecycleOptions): void {
  options.actions.clearSelectedFacility();
  options.actions.clearSelectedParcel();
  options.layers.facilitiesHoverController.value?.clear();
  options.state.hoveredFacility.value = null;
  options.state.hoveredFacilityCluster.value = null;
  resetBoundaryRuntime(options);
  options.layers.powerHoverController.value?.clear();
  options.state.hoveredPower.value = null;
  options.fiber.clearFiberHover();
}

export async function destroyMapLifecycleRuntime(
  options: UseAppShellMapLifecycleOptions
): Promise<void> {
  options.runtime.basemapLayerController.value = null;

  destroyMapLayerRuntime(options);
  destroyBoundaryRuntime(options);

  options.runtime.layerRuntime.value?.destroy();
  options.runtime.layerRuntime.value = null;
  options.state.layerRuntimeSnapshot.value = null;
  const disposeMapRuntime = options.runtime.disposeMapRuntime.value;
  options.runtime.disposeMapRuntime.value = null;
  await disposeMapRuntime?.();
  options.runtime.map.value = null;
}
