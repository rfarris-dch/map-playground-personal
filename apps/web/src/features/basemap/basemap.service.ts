import type { IMap } from "@map-migration/map-engine";
import type { BasemapProfile } from "./basemap.types";

const DEFAULT_BASEMAP_PROFILE: BasemapProfile = {
  styleUrl: "https://tiles.openfreemap.org/styles/positron",
  buildingSourceLayer: "building",
  buildingsLayerId: "basemap.3d-buildings",
  buildingsMinZoom: 15,
  buildingsOpacity: 0.65,
};

function findBuildingSourceId(map: IMap, profile: BasemapProfile): string {
  const style = map.getStyle();
  const layers = style.layers ?? [];

  for (const layer of layers) {
    if (!("source-layer" in layer)) {
      continue;
    }
    if (layer["source-layer"] !== profile.buildingSourceLayer) {
      continue;
    }
    if ("source" in layer && typeof layer.source === "string") {
      return layer.source;
    }
  }

  throw new Error(
    `[basemap] Missing "${profile.buildingSourceLayer}" source-layer in style "${style.name ?? "unnamed"}".`
  );
}

function findFirstLabelLayerId(map: IMap): string | undefined {
  const style = map.getStyle();
  const layers = style.layers ?? [];

  for (const layer of layers) {
    if (layer.type !== "symbol" || !layer.layout) {
      continue;
    }
    if ("text-field" in layer.layout) {
      return layer.id;
    }
  }

  return undefined;
}

function add3DBuildings(map: IMap, profile: BasemapProfile): void {
  const sourceId = findBuildingSourceId(map, profile);
  const firstLabelLayerId = findFirstLabelLayerId(map);

  map.addLayer(
    {
      id: profile.buildingsLayerId,
      type: "fill-extrusion",
      source: sourceId,
      "source-layer": profile.buildingSourceLayer,
      minzoom: profile.buildingsMinZoom,
      paint: {
        "fill-extrusion-color": "#d6d3d1",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": profile.buildingsOpacity,
      },
    },
    firstLabelLayerId
  );
}

export function defaultBasemapStyleUrl(): string {
  return DEFAULT_BASEMAP_PROFILE.styleUrl;
}

export function mountBasemap3DBuildings(
  map: IMap,
  profile: BasemapProfile = DEFAULT_BASEMAP_PROFILE
): () => void {
  const onLoad = (): void => {
    map.off("load", onLoad);
    add3DBuildings(map, profile);
  };

  map.on("load", onLoad);

  return (): void => {
    map.off("load", onLoad);
  };
}
