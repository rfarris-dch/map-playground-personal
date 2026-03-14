import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountGasPipelineLayer } from "@/features/gas-pipelines/gas-pipelines.layer";

export function initializeGasPipelineRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  options.layers.gasPipelineController.value = mountGasPipelineLayer(currentMap);
}

export function destroyGasPipelineRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.gasPipelineController.value?.destroy();
  options.layers.gasPipelineController.value = null;
}
