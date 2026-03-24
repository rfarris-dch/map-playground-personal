import { describe, expect, it } from "bun:test";
import {
  getBoundaryStyleLayerIds,
  getCatalogStyleLayerIds,
  getCountyPowerStoryExtrusionLayerId,
  getCountyPowerStoryStyleLayerIds,
  getFacilitiesStyleLayerIds,
  getFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds,
  getParcelsStyleLayerIds,
  getPowerStyleLayerIds,
  validateLayerOrder,
} from "@/index";

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
      clusterLayerId: "facilities.colocation.clusters",
      clusterCountLayerId: "facilities.colocation.cluster-count",
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
      "facilities.colocation.clusters",
      "facilities.colocation.cluster-count",
      "facilities.colocation.points",
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
});
