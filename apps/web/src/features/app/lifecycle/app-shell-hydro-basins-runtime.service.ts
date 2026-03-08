import { HYDRO_BASINS_LAYER_ID } from "@/features/app/core/app-shell.constants";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountHydroBasinsLayer } from "@/features/hydro-basins/hydro-basins.layer";

export function initializeHydroBasinsRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const hydroBasinsController = mountHydroBasinsLayer({
    map: currentMap,
  });
  options.layers.hydroBasinsController.value = hydroBasinsController;

  options.runtime.layerRuntime.value?.registerLayerController(
    HYDRO_BASINS_LAYER_ID,
    hydroBasinsController
  );
}

export function destroyHydroBasinsRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.runtime.layerRuntime.value?.unregisterLayerController(HYDRO_BASINS_LAYER_ID);
  options.layers.hydroBasinsController.value?.destroy();
  options.layers.hydroBasinsController.value = null;
}
