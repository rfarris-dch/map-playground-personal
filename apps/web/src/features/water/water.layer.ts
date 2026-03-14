import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import type { IMap } from "@map-migration/map-engine";
import type { WaterLayerVisibilityController } from "@/features/water/water.types";
import { mountLayerVisibilityController } from "@/lib/layer-visibility-controller.service";
import type { MountWaterLayerVisibilityOptions } from "./water.layer.types";

const WATER_TILE_URL = `${ApiRoutes.usgsWaterTile}/{z}/{x}/{y}`;

function sourceIdForLayer(styleLayerId: string): string {
  return `${styleLayerId}.source`;
}

function ensureWaterLayer(map: IMap, styleLayerId: string): void {
  const sourceId = sourceIdForLayer(styleLayerId);

  if (!map.hasSource(sourceId)) {
    map.addSource(sourceId, {
      type: "raster",
      tiles: [WATER_TILE_URL],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 24,
    });
  }

  if (map.hasLayer(styleLayerId)) {
    return;
  }

  map.addLayer({
    id: styleLayerId,
    type: "raster",
    source: sourceId,
    paint: {
      "raster-opacity": 0.6,
      "raster-fade-duration": 0,
    },
  });
}

export function mountWaterLayerVisibility(
  options: MountWaterLayerVisibilityOptions
): WaterLayerVisibilityController {
  function applyVisibility(): void {
    if (!options.map.hasLayer(options.styleLayerId)) {
      return;
    }

    options.map.setLayerVisibility(options.styleLayerId, visibilityState.value);
  }
  const visibilityState = {
    value: true,
  };
  const controller = mountLayerVisibilityController({
    applyVisibility(visible) {
      visibilityState.value = visible;
      applyVisibility();
    },
    destroyLayers() {
      if (options.map.hasLayer(options.styleLayerId)) {
        options.map.removeLayer(options.styleLayerId);
      }

      const sourceId = sourceIdForLayer(options.styleLayerId);
      if (options.map.hasSource(sourceId)) {
        options.map.removeSource(sourceId);
      }
    },
    ensureReady() {
      ensureWaterLayer(options.map, options.styleLayerId);
    },
    map: options.map,
    startWhenStyleReady: true,
  });

  return {
    layerId: options.layerId,
    setVisible(nextVisible: boolean): void {
      controller.setVisible(nextVisible);
    },
    destroy(): void {
      controller.destroy();
    },
  };
}
