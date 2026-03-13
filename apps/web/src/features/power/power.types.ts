import type { MapExpression } from "@map-migration/map-engine";
import type { LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type PowerLayerId = "transmission" | "substations" | "plants";

export interface PowerVisibilityState {
  readonly plants: boolean;
  readonly substations: boolean;
  readonly transmission: boolean;
}

export interface PowerLayerVisibilityController extends LayerVisibilityController {
  readonly layerId: PowerLayerId;
  setFilter(filter: MapExpression | null): void;
}
