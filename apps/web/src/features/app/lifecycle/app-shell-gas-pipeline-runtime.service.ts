import { GAS_PIPELINES_LAYER_ID } from "@/features/app/core/app-shell.constants";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountGasPipelineLayer } from "@/features/gas-pipelines/gas-pipelines.layer";

export function initializeGasPipelineRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const controller = mountGasPipelineLayer(currentMap);
  options.layers.gasPipelineController.value = controller;

  options.runtime.layerRuntime.value?.registerLayerController(GAS_PIPELINES_LAYER_ID, controller);
}

export function destroyGasPipelineRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.runtime.layerRuntime.value?.unregisterLayerController(GAS_PIPELINES_LAYER_ID);

  const controller = options.layers.gasPipelineController;
  if (typeof controller === "undefined") {
    return;
  }

  controller.value?.destroy();
  controller.value = null;
}
