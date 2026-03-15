import type { LayerStatus, LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type WaterLayerId = "features";

export interface WaterLayerVisibilityController extends LayerVisibilityController {
  readonly layerId: WaterLayerId;
  readonly status: LayerStatus;
}
