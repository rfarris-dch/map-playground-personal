import type { IMap } from "@map-migration/map-engine";
import type { LayerId } from "@map-migration/map-layer-catalog";
import type { PowerLayerId, PowerLayerVisibilityController } from "./power.types";

interface MountPowerLayerVisibilityOptions {
  readonly layerId: PowerLayerId;
  readonly map: IMap;
  readonly styleLayerId: LayerId;
}

const POWER_SOURCE_ID = "power.infrastructure";
const POWER_VECTOR_TILE_URL = "https://openinframap.org/map/power/{z}/{x}/{y}.pbf";
const POWER_STYLE_LAYER_IDS_BY_ID: Readonly<Record<PowerLayerId, readonly string[]>> = {
  transmission: ["power.transmission"],
  substations: ["power.substations-area", "power.substations"],
  plants: ["power.plants-area", "power.plants"],
};

function powerStyleLayerIds(layerId: PowerLayerId): readonly string[] {
  return POWER_STYLE_LAYER_IDS_BY_ID[layerId];
}

function ensurePowerSource(map: IMap): void {
  if (map.hasSource(POWER_SOURCE_ID)) {
    return;
  }

  map.addSource(POWER_SOURCE_ID, {
    type: "vector",
    tiles: [POWER_VECTOR_TILE_URL],
    maxzoom: 17,
  });
}

function ensurePowerLayers(map: IMap): void {
  ensurePowerSource(map);

  if (!map.hasLayer("power.transmission")) {
    map.addLayer({
      id: "power.transmission",
      type: "line",
      source: POWER_SOURCE_ID,
      "source-layer": "power_line",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": [
          "case",
          [">=", ["coalesce", ["to-number", ["get", "voltage"]], 0], 500_000],
          "#6d28d9",
          [">=", ["coalesce", ["to-number", ["get", "voltage"]], 0], 220_000],
          "#dc2626",
          [">=", ["coalesce", ["to-number", ["get", "voltage"]], 0], 100_000],
          "#f97316",
          "#1d4ed8",
        ],
        "line-opacity": 0.75,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 9, 1.2, 13, 2.2],
      },
    });
  }

  if (!map.hasLayer("power.substations-area")) {
    map.addLayer({
      id: "power.substations-area",
      type: "circle",
      source: POWER_SOURCE_ID,
      "source-layer": "power_substation_point",
      paint: {
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#fdba74",
          "#fb923c",
        ],
        "circle-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.2,
          ["interpolate", ["linear"], ["zoom"], 0, 0.08, 6, 0.09, 10, 0.08, 14, 0.06],
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 4.2, 6, 6.8, 10, 9.5, 14, 12],
      },
    });
  }

  if (!map.hasLayer("power.substations")) {
    map.addLayer({
      id: "power.substations",
      type: "circle",
      source: POWER_SOURCE_ID,
      "source-layer": "power_substation_point",
      paint: {
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#fb923c",
          "#f97316",
        ],
        "circle-stroke-color": "#111827",
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 1],
        "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.9],
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          ["interpolate", ["linear"], ["zoom"], 0, 3.8, 6, 4.5, 10, 6.1, 14, 8.2],
          ["interpolate", ["linear"], ["zoom"], 0, 3.1, 6, 3.8, 10, 5.2, 14, 7],
        ],
      },
    });
  }

  if (!map.hasLayer("power.plants-area")) {
    map.addLayer({
      id: "power.plants-area",
      type: "fill",
      source: POWER_SOURCE_ID,
      "source-layer": "power_plant",
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#4ade80",
          "#22c55e",
        ],
        "fill-outline-color": "#15803d",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.24,
          ["interpolate", ["linear"], ["zoom"], 0, 0.16, 6, 0.14, 10, 0.12, 14, 0.1, 18, 0.08],
        ],
      },
    });
  }

  if (!map.hasLayer("power.plants")) {
    map.addLayer({
      id: "power.plants",
      type: "circle",
      source: POWER_SOURCE_ID,
      "source-layer": "power_plant_point",
      paint: {
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#22c55e",
          "#16a34a",
        ],
        "circle-stroke-color": "#14532d",
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 1],
        "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.85],
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          ["interpolate", ["linear"], ["zoom"], 0, 3.4, 6, 4.2, 10, 5.6, 14, 7.1],
          ["interpolate", ["linear"], ["zoom"], 0, 2.8, 6, 3.5, 10, 4.8, 14, 6.3],
        ],
      },
    });
  }
}

export function mountPowerLayerVisibility(
  options: MountPowerLayerVisibilityOptions
): PowerLayerVisibilityController {
  let visible = true;

  function applyVisibility(): void {
    for (const styleLayerId of powerStyleLayerIds(options.layerId)) {
      if (!options.map.hasLayer(styleLayerId)) {
        continue;
      }

      options.map.setLayerVisibility(styleLayerId, visible);
    }
  }

  const onLoad = (): void => {
    ensurePowerLayers(options.map);
    applyVisibility();
  };

  options.map.on("load", onLoad);

  return {
    layerId: options.layerId,
    setVisible(nextVisible: boolean): void {
      visible = nextVisible;
      applyVisibility();
    },
    destroy(): void {
      options.map.off("load", onLoad);
    },
  };
}
