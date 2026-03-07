import {
  destroyBoundaryRuntime,
  initializeBoundaryRuntime,
  resetBoundaryRuntime,
} from "@/features/app/boundary/app-shell-boundary-runtime.service";
import {
  initializeAppShellMap,
  suppressMapLibreGlyphWarnings,
} from "@/features/app/lifecycle/app-shell-map.service";
import {
  destroyMapLayerRuntime,
  initializeMapLayerRuntime,
} from "@/features/app/lifecycle/app-shell-map-layer-runtime.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { createLayerRuntime } from "@/features/layers/layer-runtime.service";

export function initializeMapLifecycleRuntime(options: UseAppShellMapLifecycleOptions): void {
  const container = options.runtime.mapContainer.value;
  if (container === null) {
    return;
  }

  const mapSetup = initializeAppShellMap(container, {
    initialViewport: options.initialViewport,
  });
  options.runtime.disposePmtilesProtocol.value = mapSetup.disposePmtilesProtocol;
  options.runtime.map.value = mapSetup.map;
  options.runtime.layerRuntime.value = createLayerRuntime(mapSetup.map);
  options.runtime.basemapLayerController.value = mapSetup.basemapLayerController;
  options.runtime.mapControls.value = mapSetup.controls;
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
  resetBoundaryRuntime(options);
  options.layers.powerHoverController.value?.clear();
  options.state.hoveredPower.value = null;
  options.fiber.clearFiberHover();
}

export function destroyMapLifecycleRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.runtime.basemapLayerController.value?.destroy();
  options.runtime.basemapLayerController.value = null;

  destroyMapLayerRuntime(options);
  destroyBoundaryRuntime(options);

  const currentMap = options.runtime.map.value;

  options.runtime.layerRuntime.value?.destroy();
  options.runtime.layerRuntime.value = null;

  if (currentMap !== null) {
    options.runtime.mapControls.value.reduce((_, control) => {
      currentMap.removeControl(control);
      return 0;
    }, 0);
  }

  options.runtime.mapControls.value = [];
  currentMap?.destroy();
  options.runtime.map.value = null;

  options.runtime.disposePmtilesProtocol.value?.();
  options.runtime.disposePmtilesProtocol.value = null;

  options.runtime.restoreConsoleWarn.value?.();
  options.runtime.restoreConsoleWarn.value = null;
}

export function restoreSuppressedGlyphWarnings(): () => void {
  return suppressMapLibreGlyphWarnings();
}
