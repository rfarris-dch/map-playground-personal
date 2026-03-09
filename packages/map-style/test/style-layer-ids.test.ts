import { describe, expect, it } from "bun:test";
import {
  getBoundaryStyleLayerIds,
  getCatalogStyleLayerIds,
  getFacilitiesStyleLayerIds,
  getFloodStyleLayerIds,
  getHydroBasinsStyleLayerIds,
  getParcelsStyleLayerIds,
  getPowerStyleLayerIds,
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
      outline100LayerId: "environmental-flood-100-outline",
      outline500LayerId: "environmental-flood-500-outline",
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
      "environmental-flood-100-outline",
    ]);
    expect(getCatalogStyleLayerIds("environmental.flood-500")).toEqual([
      "environmental-flood-500-fill",
      "environmental-flood-500-outline",
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
});
