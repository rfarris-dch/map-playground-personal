import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountSketchMeasureLayer } from "@/features/sketch-measure/sketch-measure.layer";

export function initializeMeasureRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  options.layers.sketchMeasureController.value = mountSketchMeasureLayer(currentMap, {
    onStateChange: (nextState) => {
      options.state.sketchMeasureState.value = nextState;
    },
  });
}

export function destroyMeasureRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.sketchMeasureController.value?.destroy();
  options.layers.sketchMeasureController.value = null;
}
