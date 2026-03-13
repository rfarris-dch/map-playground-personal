import { describe, expect, it } from "bun:test";
import {
  defaultBasemapVisibilityState,
  mountBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import { FakeMap } from "../../support/fake-map";

describe("basemap service", () => {
  it("adds a zoom-ramped 3d building extrusion layer beneath labels", () => {
    const map = new FakeMap({
      style: {
        version: 8,
        sources: {
          openmaptiles: {
            type: "vector",
          },
        },
        layers: [
          {
            id: "building-footprints",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "building",
          },
          {
            id: "place-labels",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "place",
            layout: {
              "text-field": ["get", "name"],
            },
          },
        ],
      },
    });

    map.addSource("openmaptiles", {
      type: "vector",
    });

    const controller = mountBasemapLayerVisibility(map, {
      visibility: defaultBasemapVisibilityState(),
    });

    map.emit("load");

    const addedLayer = map.addedLayers.get("basemap.3d-buildings");
    expect(addedLayer?.beforeId).toBe("place-labels");
    expect(addedLayer?.spec.filter).toEqual(["!=", ["get", "hide_3d"], true]);
    expect(addedLayer?.spec.paint).toEqual({
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 0],
        0,
        "#d3d3d3",
        200,
        "#4169e1",
        400,
        "#add8e6",
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        16,
        ["coalesce", ["get", "render_height"], 0],
      ],
      "fill-extrusion-base": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        16,
        ["coalesce", ["get", "render_min_height"], 0],
      ],
      "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.65],
    });

    controller.destroy();
  });

  it("enables terrain and hillshade when the terrain basemap layer is visible", () => {
    const map = new FakeMap({
      style: {
        version: 8,
        sources: {
          openmaptiles: {
            type: "vector",
          },
        },
        layers: [
          {
            id: "building-footprints",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "building",
          },
          {
            id: "place-labels",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "place",
            layout: {
              "text-field": ["get", "name"],
            },
          },
        ],
      },
    });

    map.addSource("openmaptiles", {
      type: "vector",
    });

    const controller = mountBasemapLayerVisibility(map, {
      visibility: {
        ...defaultBasemapVisibilityState(),
        terrain: true,
      },
    });

    map.emit("load");

    expect(map.addedSources.get("basemap.terrain-source")).toEqual({
      type: "raster-dem",
      url: "https://demotiles.maplibre.org/terrain-tiles/tiles.json",
      tileSize: 256,
    });
    expect(map.addedLayers.get("basemap.terrain-hillshade")?.spec).toMatchObject({
      id: "basemap.terrain-hillshade",
      type: "hillshade",
      source: "basemap.terrain-source",
      paint: {
        "hillshade-shadow-color": "#473B24",
      },
    });
    expect(map.terrain).toEqual({
      source: "basemap.terrain-source",
      exaggeration: 1,
    });

    controller.setVisible("terrain", false);

    expect(map.terrain).toBeNull();
    expect(map.layerVisibilityCalls.at(-1)).toEqual({
      layerId: "basemap.terrain-hillshade",
      visible: false,
    });

    controller.destroy();
  });
});
