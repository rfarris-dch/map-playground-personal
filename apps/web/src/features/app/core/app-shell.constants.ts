import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { CountyPowerStoryId } from "@map-migration/http-contracts/county-power-story-http";
import type { LayerId } from "@map-migration/map-layer-catalog";
import type {
  CountyPowerStoryCatalogLayerId,
  CountyPowerStoryVisibleLayerId,
} from "@/features/county-power-story/county-power-story.types";
import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
import type { PowerLayerId } from "@/features/power/power.types";

export const FIBER_MIN_ZOOM = 4;
export const FLOOD_100_LAYER_ID: LayerId = "environmental.flood-100";
export const FLOOD_500_LAYER_ID: LayerId = "environmental.flood-500";
export const HYDRO_BASINS_LAYER_ID: LayerId = "environmental.hydro-basins";
export const PARCELS_LAYER_ID: LayerId = "property.parcels";
export const GAS_PIPELINES_LAYER_ID: LayerId = "infrastructure.gas-pipelines";
export const WATER_FEATURES_LAYER_ID: LayerId = "environmental.water-features";
export const COUNTY_POWER_STORY_3D_LAYER_ID: CountyPowerStoryCatalogLayerId =
  "models.county-power-3d";

const FACILITIES_LAYER_ID_BY_PERSPECTIVE: Readonly<Record<FacilityPerspective, LayerId>> = {
  colocation: "facilities.colocation",
  hyperscale: "facilities.hyperscale",
  "hyperscale-leased": "facilities.hyperscale-leased",
  enterprise: "facilities.enterprise",
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

const COUNTY_POWER_STORY_LAYER_ID_BY_ID: Readonly<
  Record<CountyPowerStoryId, CountyPowerStoryVisibleLayerId>
> = {
  "grid-stress": "models.county-power-grid-stress",
  "queue-pressure": "models.county-power-queue-pressure",
  "market-structure": "models.county-power-market-structure",
  "policy-watch": "models.county-power-policy-watch",
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

export function countyPowerStoryLayerId(
  storyId: CountyPowerStoryId
): CountyPowerStoryVisibleLayerId {
  return COUNTY_POWER_STORY_LAYER_ID_BY_ID[storyId];
}
