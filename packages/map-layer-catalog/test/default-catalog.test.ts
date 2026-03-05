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
    expect(visibleLayerCount(DEFAULT_LAYER_CATALOG)).toBe(2);
    const visibleLayerIds = LAYER_IDS.filter(
      (layerId) => DEFAULT_LAYER_CATALOG[layerId].defaultVisible
    );
    expect(visibleLayerIds).toEqual(["facilities.colocation", "facilities.hyperscale"]);
  });

  it("keeps power overlays ungated by minimum zoom", () => {
    expect(DEFAULT_LAYER_CATALOG["power.transmission"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["power.substations"].zoomMin).toBe(0);
    expect(DEFAULT_LAYER_CATALOG["power.plants"].zoomMin).toBe(0);
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
