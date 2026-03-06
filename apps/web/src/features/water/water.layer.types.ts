import type { IMap } from "@map-migration/map-engine";
import type { LayerId } from "@map-migration/map-layer-catalog";
import type { WaterLayerId } from "@/features/water/water.types";

export interface MountWaterLayerVisibilityOptions {
  readonly layerId: WaterLayerId;
  readonly map: IMap;
  readonly styleLayerId: LayerId;
}
