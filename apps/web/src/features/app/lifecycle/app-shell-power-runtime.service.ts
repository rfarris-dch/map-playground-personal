import { powerLayerId } from "@/features/app/core/app-shell.constants";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountPowerLayerVisibility } from "@/features/power/power.layer";
import { powerLayerIds } from "@/features/power/power.service";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";
import { mountPowerHover } from "@/features/power/power-hover";

export function initializePowerRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const nextPowerControllers = powerLayerIds().reduce<PowerLayerVisibilityController[]>(
    (controllers, layerId) => {
      const controller = mountPowerLayerVisibility({
        map: currentMap,
        layerId,
        styleLayerId: powerLayerId(layerId),
      });

      options.runtime.layerRuntime.value?.registerLayerController(
        powerLayerId(layerId),
        controller
      );
      controllers.push(controller);
      return controllers;
    },
    []
  );
  options.layers.powerControllers.value = nextPowerControllers;

  options.layers.powerHoverController.value = mountPowerHover(currentMap, {
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onHoverChange: (nextHover) => {
      options.state.hoveredPower.value = nextHover;
    },
  });
}

export function destroyPowerRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.powerHoverController.value?.destroy();
  options.layers.powerHoverController.value = null;
  options.state.hoveredPower.value = null;

  options.layers.powerControllers.value.reduce((_, controller) => {
    controller.destroy();
    return 0;
  }, 0);
  options.layers.powerControllers.value = [];
}
