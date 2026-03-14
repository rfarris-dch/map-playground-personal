import type { IMap, MapExpression } from "@map-migration/map-engine";
import { getPowerStyleLayerIds, type PowerCatalogLayerId } from "@map-migration/map-style";
import type { PowerLayerId, PowerLayerVisibilityController } from "@/features/power/power.types";
import type { PowerLayerMountResult } from "./power.layer.types";

const POWER_SOURCE_ID = "power.infrastructure";
const POWER_VECTOR_TILE_URL = "https://openinframap.org/map/power/{z}/{x}/{y}.pbf";

const ALL_STYLE_LAYER_IDS: readonly string[] = [
  "power.transmission",
  "power.substations-area",
  "power.substations",
  "power.plants-area",
  "power.plants",
];

function toPowerCatalogLayerId(layerId: PowerLayerId): PowerCatalogLayerId {
  if (layerId === "transmission") {
    return "power.transmission";
  }

  if (layerId === "substations") {
    return "power.substations";
  }

  return "power.plants";
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
          [">=", ["to-number", ["coalesce", ["get", "voltage"], 0]], 500_000],
          "#6d28d9",
          [">=", ["to-number", ["coalesce", ["get", "voltage"], 0]], 220_000],
          "#dc2626",
          [">=", ["to-number", ["coalesce", ["get", "voltage"], 0]], 100_000],
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
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.08],
          6,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.09],
          10,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.08],
          14,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.06],
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
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          ["case", ["boolean", ["feature-state", "hover"], false], 3.8, 3.1],
          6,
          ["case", ["boolean", ["feature-state", "hover"], false], 4.5, 3.8],
          10,
          ["case", ["boolean", ["feature-state", "hover"], false], 6.1, 5.2],
          14,
          ["case", ["boolean", ["feature-state", "hover"], false], 8.2, 7],
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
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.24, 0.16],
          6,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.24, 0.14],
          10,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.24, 0.12],
          14,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.24, 0.1],
          18,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.24, 0.08],
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
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          ["case", ["boolean", ["feature-state", "hover"], false], 3.4, 2.8],
          6,
          ["case", ["boolean", ["feature-state", "hover"], false], 4.2, 3.5],
          10,
          ["case", ["boolean", ["feature-state", "hover"], false], 5.6, 4.8],
          14,
          ["case", ["boolean", ["feature-state", "hover"], false], 7.1, 6.3],
        ],
      },
    });
  }
}

function createSubController(map: IMap, layerId: PowerLayerId): PowerLayerVisibilityController {
  let currentFilter: MapExpression | null = null;
  const visibilityState = { value: true };

  function applyVisibility(): void {
    for (const styleLayerId of getPowerStyleLayerIds(toPowerCatalogLayerId(layerId))) {
      if (!map.hasLayer(styleLayerId)) {
        continue;
      }

      map.setLayerVisibility(styleLayerId, visibilityState.value);
    }
  }

  function applyFilter(): void {
    for (const styleLayerId of getPowerStyleLayerIds(toPowerCatalogLayerId(layerId))) {
      if (!map.hasLayer(styleLayerId)) {
        continue;
      }

      map.setLayerFilter(styleLayerId, currentFilter);
    }
  }

  return {
    layerId,
    setVisible(nextVisible: boolean): void {
      visibilityState.value = nextVisible;
      applyVisibility();
    },
    setFilter(filter: MapExpression | null): void {
      currentFilter = filter;
      applyFilter();
    },
    destroy(): void {
      // No-op — parent owns source/layers
    },
  };
}

export function mountPowerLayers(options: { map: IMap }): PowerLayerMountResult {
  const { map } = options;

  const onLoad = (): void => {
    ensurePowerLayers(map);
  };

  map.on("load", onLoad);
  if ((map.getStyle()?.layers?.length ?? 0) > 0) {
    onLoad();
  }

  const transmission = createSubController(map, "transmission");
  const substations = createSubController(map, "substations");
  const plants = createSubController(map, "plants");

  return {
    controllers: {
      transmission,
      substations,
      plants,
    },
    destroy(): void {
      map.off("load", onLoad);

      for (const styleLayerId of ALL_STYLE_LAYER_IDS) {
        if (map.hasLayer(styleLayerId)) {
          map.removeLayer(styleLayerId);
        }
      }

      if (map.hasSource(POWER_SOURCE_ID)) {
        map.removeSource(POWER_SOURCE_ID);
      }
    },
  };
}
