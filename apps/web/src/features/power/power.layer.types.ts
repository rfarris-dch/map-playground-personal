import type { LayerStatus } from "@/features/layers/layer-runtime.types";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";

export interface PowerLayerMountResult {
  controllers: {
    transmission: PowerLayerVisibilityController;
    substations: PowerLayerVisibilityController;
    plants: PowerLayerVisibilityController;
  };
  destroy(): void;
  readonly status: LayerStatus;
}
