import type { LayerId } from "@map-migration/map-layer-catalog";
import { Effect } from "effect";
import type {
  LayerRuntimeController,
  LayerVisibilityController,
} from "@/features/layers/layer-runtime.types";

export function registerScopedLayerController(
  layerRuntime: LayerRuntimeController,
  layerId: LayerId,
  controller: LayerVisibilityController
) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      layerRuntime.registerLayerController(layerId, controller);
      return controller;
    }),
    (registeredController) =>
      Effect.sync(() => {
        layerRuntime.unregisterLayerController(layerId);
        registeredController.destroy();
      })
  );
}
