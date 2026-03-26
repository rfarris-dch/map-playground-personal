import { describe, expect, it } from "bun:test";
import { LAYER_IDS } from "@map-migration/map-layer-catalog";
import {
  findFirstLabelStyleLayerId,
  findFirstPresentStyleLayerId,
  getBoundaryStyleLayerIds,
  getCatalogStyleLayerIds,
  getCountyPowerStoryExtrusionLayerId,
  getCountyPowerStoryStyleLayerIds,
  getFacilitiesStyleLayerIds,
  getFacilityPlacementAnchorLayerIds,
  getFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds,
  getHyperscaleLeasedStyleLayerIds,
  getOverlayPlacementAnchorLayerIds,
  getParcelsStyleLayerIds,
  getPowerStyleLayerIds,
  validateLayerOrder,
} from "@/index";
import type { StaticCatalogLayerId } from "@/index.types";

describe("style layer ids", () => {
  it("keeps the exact derived ids for boundary, flood, facilities, and parcels layers", () => {
    expect(getBoundaryStyleLayerIds("county")).toEqual({
      fillLayerId: "county.fill",
      outlineLayerId: "county",
    });
    expect(getFloodStyleLayerIds("environmental.flood-100")).toEqual({
      fill100LayerId: "environmental-flood-100-fill",
      fill500LayerId: "environmental-flood-500-fill",
    });
    expect(getFacilitiesStyleLayerIds("facilities.colocation")).toEqual({
      heatmapLayerId: "facilities.colocation.heatmap",
      clusterLayerId: "facilities.colocation.clusters",
      iconFallbackLayerId: "facilities.colocation.icon-fallback",
      pointLayerId: "facilities.colocation.points",
    });
    expect(getParcelsStyleLayerIds()).toEqual({
      fillLayerId: "property.parcels.fill",
      outlineLayerId: "property.parcels",
    });
    expect(getCountyPowerStoryStyleLayerIds("models.county-power-grid-stress")).toEqual({
      fillLayerId: "models.county-power-grid-stress.fill",
      outlineLayerId: "models.county-power-grid-stress.outline",
    });
    expect(getCountyPowerStoryExtrusionLayerId()).toBe("models.county-power-3d.fill-extrusion");
    expect(getFacilitiesStyleLayerIds("facilities.enterprise")).toEqual({
      heatmapLayerId: "facilities.enterprise.heatmap",
      clusterLayerId: "facilities.enterprise.clusters",
      iconFallbackLayerId: "facilities.enterprise.icon-fallback",
      pointLayerId: "facilities.enterprise.points",
    });
    expect(getHyperscaleLeasedStyleLayerIds()).toEqual({
      fillLayerId: "hyperscale-leased-voronoi.fill",
      lineLayerId: "hyperscale-leased-voronoi.line",
    });
  });

  it("keeps the current hydro and power layer ordering", () => {
    expect(getHydroBasinsStyleLayerIds()).toEqual({
      lineLayerIds: [
        "environmental-hydro-basins-huc4-line",
        "environmental-hydro-basins-huc6-line",
        "environmental-hydro-basins-huc8-line",
        "environmental-hydro-basins-huc10-line",
        "environmental-hydro-basins-huc12-line",
      ],
      labelLayerIds: [
        "environmental-hydro-basins-huc4-label",
        "environmental-hydro-basins-huc6-label",
        "environmental-hydro-basins-huc8-label",
        "environmental-hydro-basins-huc10-label",
      ],
    });
    expect(getPowerStyleLayerIds("power.transmission")).toEqual(["power.transmission"]);
    expect(getPowerStyleLayerIds("power.substations")).toEqual([
      "power.substations-area",
      "power.substations",
    ]);
    expect(getPowerStyleLayerIds("power.plants")).toEqual(["power.plants-area", "power.plants"]);
  });

  it("keeps catalog layer expansion byte-for-byte stable", () => {
    expect(getCatalogStyleLayerIds("county")).toEqual(["county.fill", "county"]);
    expect(getCatalogStyleLayerIds("environmental.flood-100")).toEqual([
      "environmental-flood-100-fill",
    ]);
    expect(getCatalogStyleLayerIds("environmental.flood-500")).toEqual([
      "environmental-flood-500-fill",
    ]);
    expect(getCatalogStyleLayerIds("environmental.hydro-basins")).toEqual([
      "environmental-hydro-basins-huc4-line",
      "environmental-hydro-basins-huc6-line",
      "environmental-hydro-basins-huc8-line",
      "environmental-hydro-basins-huc10-line",
      "environmental-hydro-basins-huc12-line",
      "environmental-hydro-basins-huc4-label",
      "environmental-hydro-basins-huc6-label",
      "environmental-hydro-basins-huc8-label",
      "environmental-hydro-basins-huc10-label",
    ]);
    expect(getCatalogStyleLayerIds("facilities.colocation")).toEqual([
      "facilities.colocation.heatmap",
      "facilities.colocation.clusters",
      "facilities.colocation.icon-fallback",
      "facilities.colocation.points",
    ]);
    expect(getCatalogStyleLayerIds("facilities.enterprise")).toEqual([
      "facilities.enterprise.heatmap",
      "facilities.enterprise.clusters",
      "facilities.enterprise.icon-fallback",
      "facilities.enterprise.points",
    ]);
    expect(getCatalogStyleLayerIds("facilities.hyperscale-leased")).toEqual([
      "hyperscale-leased-voronoi.fill",
      "hyperscale-leased-voronoi.line",
    ]);
    expect(getCatalogStyleLayerIds("power.plants")).toEqual(["power.plants-area", "power.plants"]);
    expect(getCatalogStyleLayerIds("environmental.water-features")).toEqual([
      "environmental.water-features",
    ]);
    expect(getCatalogStyleLayerIds("property.parcels")).toEqual([
      "property.parcels.fill",
      "property.parcels",
    ]);
  });

  it("handles every StaticCatalogLayerId without throwing", () => {
    const excludedLayerIds = new Set([
      "fiber-locator.metro",
      "fiber-locator.longhaul",
      "infrastructure.gas-pipelines",
      "models.county-power-grid-stress",
      "models.county-power-queue-pressure",
      "models.county-power-market-structure",
      "models.county-power-policy-watch",
      "models.county-power-3d",
    ]);

    for (const layerId of LAYER_IDS) {
      if (excludedLayerIds.has(layerId)) {
        continue;
      }

      const result = getCatalogStyleLayerIds(layerId as StaticCatalogLayerId);
      expect(result.length).toBeGreaterThan(0);
      for (const styleLayerId of result) {
        expect(typeof styleLayerId).toBe("string");
        expect(styleLayerId.length).toBeGreaterThan(0);
      }
    }
  });

  it("validates county power story model layers against facility and parcel ordering", () => {
    expect(
      validateLayerOrder(["models.county-power-grid-stress.fill", "facilities.colocation.points"])
    ).toEqual([]);

    expect(
      validateLayerOrder(["facilities.colocation.points", "models.county-power-grid-stress.fill"])
    ).toContain(
      "countyPowerGridStressBelowColocation failed: models.county-power-grid-stress.fill must be before facilities.colocation.points"
    );

    expect(
      validateLayerOrder(["property.parcels", "models.county-power-3d.fill-extrusion"])
    ).toContain(
      "parcelOutlinesAboveCountyPower3d failed: models.county-power-3d.fill-extrusion must be before property.parcels"
    );
  });

  it("keeps placement anchors aligned with the actual facility render layer ids", () => {
    expect(getFacilityPlacementAnchorLayerIds()).toEqual([
      "hyperscale-leased-voronoi.fill",
      "hyperscale-leased-voronoi.line",
      "facilities.colocation.heatmap",
      "facilities.colocation.clusters",
      "facilities.colocation.icon-fallback",
      "facilities.colocation.points",
      "facilities.hyperscale.heatmap",
      "facilities.hyperscale.clusters",
      "facilities.hyperscale.icon-fallback",
      "facilities.hyperscale.points",
      "facilities.enterprise.heatmap",
      "facilities.enterprise.clusters",
      "facilities.enterprise.icon-fallback",
      "facilities.enterprise.points",
    ]);
    expect(getOverlayPlacementAnchorLayerIds()).toEqual([
      "property.parcels.fill",
      "property.parcels",
      "hyperscale-leased-voronoi.fill",
      "hyperscale-leased-voronoi.line",
      "facilities.colocation.heatmap",
      "facilities.colocation.clusters",
      "facilities.colocation.icon-fallback",
      "facilities.colocation.points",
      "facilities.hyperscale.heatmap",
      "facilities.hyperscale.clusters",
      "facilities.hyperscale.icon-fallback",
      "facilities.hyperscale.points",
      "facilities.enterprise.heatmap",
      "facilities.enterprise.clusters",
      "facilities.enterprise.icon-fallback",
      "facilities.enterprise.points",
    ]);
  });

  it("finds the first present anchor layer and first label layer from map state", () => {
    const presentLayerIds = new Set(["facilities.enterprise.points"]);
    const mapWithAnchors = {
      getStyle() {
        return {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: {
                "background-color": "#f8f7f3",
              },
            },
            {
              id: "places.label",
              type: "symbol",
              source: "openmaptiles",
              layout: {
                "text-field": ["get", "name"],
              },
            },
          ],
        };
      },
      hasLayer(layerId: string) {
        return presentLayerIds.has(layerId);
      },
    };

    expect(findFirstPresentStyleLayerId(mapWithAnchors, getFacilityPlacementAnchorLayerIds())).toBe(
      "facilities.enterprise.points"
    );
    expect(findFirstLabelStyleLayerId(mapWithAnchors)).toBe("places.label");
  });
});
