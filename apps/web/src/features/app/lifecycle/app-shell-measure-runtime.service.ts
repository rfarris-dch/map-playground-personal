import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountMeasureLayer } from "@/features/measure/measure.layer";

export function initializeMeasureRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  options.layers.measureController.value = mountMeasureLayer(currentMap, {
    onStateChange: (nextState) => {
      options.state.measureState.value = nextState;
    },
  });
}

export function destroyMeasureRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.measureController.value?.destroy();
  options.layers.measureController.value = null;
}
