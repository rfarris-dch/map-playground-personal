import type { FacilityPerspective } from "@map-migration/geo-kernel";
import type { LayerId } from "@map-migration/map-layer-catalog";
import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
import type { PowerLayerId } from "@/features/power/power.types";

export const MAPLIBRE_GLYPH_WARNING_PREFIX = "Unable to load glyph range";
export const FIBER_MIN_ZOOM = 4;
export const FLOOD_100_LAYER_ID: LayerId = "environmental.flood-100";
export const FLOOD_500_LAYER_ID: LayerId = "environmental.flood-500";
export const HYDRO_BASINS_LAYER_ID: LayerId = "environmental.hydro-basins";
export const PARCELS_LAYER_ID: LayerId = "property.parcels";
export const WATER_FEATURES_LAYER_ID: LayerId = "environmental.water-features";

const FACILITIES_LAYER_ID_BY_PERSPECTIVE: Readonly<Record<FacilityPerspective, LayerId>> = {
  colocation: "facilities.colocation",
  hyperscale: "facilities.hyperscale",
};

const FIBER_LAYER_ID_BY_LINE_ID: Readonly<Record<FiberLocatorLineId, LayerId>> = {
  metro: "fiber-locator.metro",
  longhaul: "fiber-locator.longhaul",
};

const POWER_LAYER_ID_BY_ID: Readonly<Record<PowerLayerId, LayerId>> = {
  transmission: "power.transmission",
  substations: "power.substations",
  plants: "power.plants",
};

export function facilitiesLayerId(perspective: FacilityPerspective): LayerId {
  return FACILITIES_LAYER_ID_BY_PERSPECTIVE[perspective];
}

export function fiberLayerId(lineId: FiberLocatorLineId): LayerId {
  return FIBER_LAYER_ID_BY_LINE_ID[lineId];
}

export function powerLayerId(layerId: PowerLayerId): LayerId {
  return POWER_LAYER_ID_BY_ID[layerId];
}
