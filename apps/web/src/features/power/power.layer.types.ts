import type { PowerLayerVisibilityController } from "@/features/power/power.types";

export interface PowerLayerMountResult {
  controllers: {
    transmission: PowerLayerVisibilityController;
    substations: PowerLayerVisibilityController;
    plants: PowerLayerVisibilityController;
  };
  destroy(): void;
}
