import type { IMap } from "@map-migration/map-engine";
import type { LayerId } from "@map-migration/map-layer-catalog";
import type { PowerLayerId } from "@/features/power/power.types";

export interface MountPowerLayerVisibilityOptions {
  readonly layerId: PowerLayerId;
  readonly map: IMap;
  readonly styleLayerId: LayerId;
}
