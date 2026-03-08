import { FLOOD_100_LAYER_ID, FLOOD_500_LAYER_ID } from "@/features/app/core/app-shell.constants";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountFloodLayers } from "@/features/flood/flood.layer";

export function initializeFloodRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const floodLayersController = mountFloodLayers({
    map: currentMap,
  });
  options.layers.floodLayersController.value = floodLayersController;

  options.runtime.layerRuntime.value?.registerLayerController(
    FLOOD_100_LAYER_ID,
    floodLayersController.controllers.flood100
  );
  options.runtime.layerRuntime.value?.registerLayerController(
    FLOOD_500_LAYER_ID,
    floodLayersController.controllers.flood500
  );
}

export function destroyFloodRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.runtime.layerRuntime.value?.unregisterLayerController(FLOOD_100_LAYER_ID);
  options.runtime.layerRuntime.value?.unregisterLayerController(FLOOD_500_LAYER_ID);
  options.layers.floodLayersController.value?.destroy();
  options.layers.floodLayersController.value = null;
}
