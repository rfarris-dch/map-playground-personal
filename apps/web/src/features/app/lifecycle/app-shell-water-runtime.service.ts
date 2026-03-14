import { WATER_FEATURES_LAYER_ID } from "@/features/app/core/app-shell.constants";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountWaterLayerVisibility } from "@/features/water/water.layer";

export function initializeWaterRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  options.layers.waterController.value = mountWaterLayerVisibility({
    map: currentMap,
    layerId: "features",
    styleLayerId: WATER_FEATURES_LAYER_ID,
  });

  options.runtime.layerRuntime.value?.registerLayerController(
    WATER_FEATURES_LAYER_ID,
    options.layers.waterController.value
  );
}

export function destroyWaterRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.runtime.layerRuntime.value?.unregisterLayerController(WATER_FEATURES_LAYER_ID);
  options.layers.waterController.value?.destroy();
  options.layers.waterController.value = null;
}
