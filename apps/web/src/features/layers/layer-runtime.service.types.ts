import type { LayerId } from "@map-migration/map-layer-catalog";
import type { LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export interface LayerRuntimeState {
  controllers: Map<LayerId, LayerVisibilityController>;
  destroyed: boolean;
  effectiveVisibility: Map<LayerId, boolean>;
  stressBlocked: Map<LayerId, boolean>;
  userVisibility: Map<LayerId, boolean>;
}
