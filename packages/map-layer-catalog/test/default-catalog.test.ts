import { describe, expect, it } from "bun:test";
import { DEFAULT_LAYER_CATALOG, LAYER_IDS, validateLayerCatalog, visibleLayerCount } from "@/index";

describe("default layer catalog", () => {
  it("passes catalog validation", () => {
    expect(validateLayerCatalog(DEFAULT_LAYER_CATALOG)).toEqual([]);
  });

  it("keeps feature layers independently toggleable", () => {
    for (const layerId of LAYER_IDS) {
      if (layerId === "county" || layerId === "state" || layerId === "country") {
        continue;
      }

      expect(DEFAULT_LAYER_CATALOG[layerId].dependencies).toEqual([]);
    }
  });

  it("retains the current default visible-layer baseline", () => {
    expect(visibleLayerCount(DEFAULT_LAYER_CATALOG)).toBe(3);
    const visibleLayerIds = LAYER_IDS.filter(
      (layerId) => DEFAULT_LAYER_CATALOG[layerId].defaultVisible
    );
    expect(visibleLayerIds).toEqual(["state", "facilities.colocation", "facilities.hyperscale"]);
  });

  it("keeps power overlays ungated by minimum zoom", () => {
    expect(DEFAULT_LAYER_CATALOG["power.transmission"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["power.substations"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["power.plants"].zoomMin).toBe(0);
  });

  it("keeps facilities overlays available at all zoom levels", () => {
    expect(DEFAULT_LAYER_CATALOG["facilities.colocation"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["facilities.hyperscale"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["facilities.hyperscale-leased"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["facilities.enterprise"].zoomMin).toBe(0);
  });

  it("keeps county-power 3d available at all zoom levels", () => {
    expect(DEFAULT_LAYER_CATALOG["models.county-power-3d"].zoomMin).toBe(0);
  });

  it("keeps county-power 2d stories available at all zoom levels", () => {
    expect(DEFAULT_LAYER_CATALOG["models.county-power-grid-stress"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["models.county-power-queue-pressure"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["models.county-power-market-structure"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["models.county-power-policy-watch"].zoomMin).toBe(0);
  });

  it("keeps environmental flood overlays aligned to a shared vector source at parcel zooms", () => {
    expect(DEFAULT_LAYER_CATALOG["environmental.flood-100"].sourceId).toBe("environmental-flood");
    expect(DEFAULT_LAYER_CATALOG["environmental.flood-500"].sourceId).toBe("environmental-flood");
    expect(DEFAULT_LAYER_CATALOG["environmental.flood-100"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["environmental.flood-500"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["environmental.flood-100"].sourceType).toBe("vector");
    expect(DEFAULT_LAYER_CATALOG["environmental.flood-500"].sourceType).toBe("vector");
  });

  it("keeps hydro basins on a single contextual vector source", () => {
    expect(DEFAULT_LAYER_CATALOG["environmental.hydro-basins"].sourceId).toBe(
      "environmental-hydro-basins"
    );
    expect(DEFAULT_LAYER_CATALOG["environmental.hydro-basins"].zoomMin).toBe(5);
    expect(DEFAULT_LAYER_CATALOG["environmental.hydro-basins"].sourceType).toBe("vector");
  });

  it("rejects feature layers that depend on boundary layers", () => {
    const invalidBoundaryDependency: readonly ["county"] = ["county"];
    const invalidCatalog = {
      ...DEFAULT_LAYER_CATALOG,
      "facilities.colocation": {
        ...DEFAULT_LAYER_CATALOG["facilities.colocation"],
        dependencies: invalidBoundaryDependency,
      },
    };

    expect(validateLayerCatalog(invalidCatalog)).toContain(
      "Invalid boundary dependency for facilities.colocation: county"
    );
  });
});
