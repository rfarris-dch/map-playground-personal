import type { PowerLayerId } from "@/features/power/power.types";
import type { PowerLayerMetadata } from "./power.service.types";

const POWER_LAYER_IDS: readonly PowerLayerId[] = ["transmission", "substations", "plants"];

const POWER_LAYER_METADATA: Readonly<Record<PowerLayerId, PowerLayerMetadata>> = {
  transmission: {
    label: "Transmission",
    description: "High-voltage transmission corridors",
    color: "#1d4ed8",
  },
  substations: {
    label: "Substations",
    description: "Grid substations and switching points (zoom 5+)",
    color: "#f97316",
  },
  plants: {
    label: "Plants",
    description: "Power generation plant locations (zoom 5+)",
    color: "#16a34a",
  },
};

export function powerLayerIds(): readonly PowerLayerId[] {
  return POWER_LAYER_IDS;
}

export function powerLayerMetadata(layerId: PowerLayerId): PowerLayerMetadata {
  return POWER_LAYER_METADATA[layerId];
}
