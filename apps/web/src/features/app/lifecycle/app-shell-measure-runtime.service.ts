import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountSketchMeasureLayer } from "@/features/sketch-measure/sketch-measure.layer";

export function initializeMeasureRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const controller = mountSketchMeasureLayer(currentMap, {
    onStateChange: (nextState) => {
      options.state.sketchMeasureState.value = nextState;
    },
  });
  options.layers.sketchMeasureController.value = controller;

  const initialState = options.state.sketchMeasureState.value;
  if (initialState.areaShape !== "freeform") {
    controller.setAreaShape(initialState.areaShape);
  }
  if (initialState.mode !== "off") {
    controller.setMode(initialState.mode);
  }
}

export function destroyMeasureRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.layers.sketchMeasureController.value?.destroy();
  options.layers.sketchMeasureController.value = null;
}
