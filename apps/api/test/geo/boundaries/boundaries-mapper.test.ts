import { describe, expect, it } from "bun:test";
import { mapBoundaryPowerRowsToFeatures } from "@/geo/boundaries/boundaries.mapper";
import type { BoundaryPowerRow } from "@/geo/boundaries/boundaries.repo";

function buildRow(overrides: Partial<BoundaryPowerRow> = {}): BoundaryPowerRow {
  return {
    commissioned_power_mw: "55.5",
    geom_json: {
      type: "Polygon",
      coordinates: [
        [
          [-97.8, 30.2],
          [-97.7, 30.2],
          [-97.7, 30.3],
          [-97.8, 30.3],
          [-97.8, 30.2],
        ],
      ],
    },
    parent_region_name: "Texas",
    region_id: "48453",
    region_name: "Travis",
    ...overrides,
  };
}

describe("boundaries mapper", () => {
  it("maps valid rows to features", () => {
    const features = mapBoundaryPowerRowsToFeatures([buildRow()], "county");

    expect(features).toHaveLength(1);
    const first = features[0];
    if (!first) {
      throw new Error("Expected mapped feature");
    }

    expect(first.id).toBe("48453");
    expect(first.properties.level).toBe("county");
    expect(first.properties.regionName).toBe("Travis");
    expect(first.properties.parentRegionName).toBe("Texas");
    expect(first.properties.commissionedPowerMw).toBe(55.5);
  });

  it("throws when commissioned power is invalid", () => {
    expect(() =>
      mapBoundaryPowerRowsToFeatures(
        [
          buildRow({
            commissioned_power_mw: "not-a-number",
          }),
        ],
        "county"
      )
    ).toThrow("Invalid boundary row: commissioned_power_mw must be a nonnegative number");
  });
});
