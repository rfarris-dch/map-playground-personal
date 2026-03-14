import type { MapExpression } from "@map-migration/map-engine";
import type { LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export interface GasPipelineLayerController extends LayerVisibilityController {
  setFilter(filter: MapExpression | null): void;
}
