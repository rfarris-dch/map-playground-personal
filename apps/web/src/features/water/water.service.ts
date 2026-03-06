import type { WaterLayerId } from "@/features/water/water.types";
import type { WaterLayerMetadata } from "./water.service.types";

export type { WaterLayerMetadata } from "./water.service.types";

const WATER_LAYER_IDS: readonly WaterLayerId[] = ["features"];

const WATER_LAYER_METADATA: Readonly<Record<WaterLayerId, WaterLayerMetadata>> = {
  features: {
    label: "USGS Water Features",
    description: "Rivers, streams, lakes, and reservoirs from the USGS HydroCached tiles",
    color: "#5d69b1",
  },
};

export function waterLayerIds(): readonly WaterLayerId[] {
  return WATER_LAYER_IDS;
}

export function waterLayerMetadata(layerId: WaterLayerId): WaterLayerMetadata {
  return WATER_LAYER_METADATA[layerId];
}
