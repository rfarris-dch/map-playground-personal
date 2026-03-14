import { powerLayerId } from "@/features/app/core/app-shell.constants";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountPowerLayers } from "@/features/power/power.layer";
import { powerLayerIds } from "@/features/power/power.service";
import { mountPowerHover } from "@/features/power/power-hover";

export function initializePowerRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const powerLayersResult = mountPowerLayers({ map: currentMap });
  options.layers.powerLayersController.value = powerLayersResult;

  options.runtime.layerRuntime.value?.registerLayerController(
    powerLayerId("transmission"),
    powerLayersResult.controllers.transmission
  );
  options.runtime.layerRuntime.value?.registerLayerController(
    powerLayerId("substations"),
    powerLayersResult.controllers.substations
  );
  options.runtime.layerRuntime.value?.registerLayerController(
    powerLayerId("plants"),
    powerLayersResult.controllers.plants
  );

  options.layers.powerHoverController.value = mountPowerHover(currentMap, {
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onHoverChange: (nextHover) => {
      options.state.hoveredPower.value = nextHover;
    },
  });
}

export function destroyPowerRuntime(options: UseAppShellMapLifecycleOptions): void {
  for (const id of powerLayerIds()) {
    options.runtime.layerRuntime.value?.unregisterLayerController(powerLayerId(id));
  }

  options.layers.powerHoverController.value?.destroy();
  options.layers.powerHoverController.value = null;
  options.state.hoveredPower.value = null;

  options.layers.powerLayersController.value?.destroy();
  options.layers.powerLayersController.value = null;
}
