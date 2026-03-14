import { describe, expect, it, mock } from "bun:test";
import type { FacilitiesSelectionRequest } from "@map-migration/http-contracts";

mock.restore();

const {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  facilitiesSelectionBboxExceedsLimits,
  resolveFacilitiesSelectionGeometry,
} = await import("@/geo/facilities/route/facilities-route-policy.service");

function buildGeometry(
  coordinates: FacilitiesSelectionRequest["geometry"]["coordinates"]
): FacilitiesSelectionRequest["geometry"] {
  return {
    type: "Polygon",
    coordinates,
  };
}

describe("facilities route policy service", () => {
  it("computes polygon bbox bounds used by selection route policy", () => {
    const geometry = buildGeometry([
      [
        [-97.8, 30.2],
        [-97.6, 30.2],
        [-97.6, 30.4],
        [-97.8, 30.4],
        [-97.8, 30.2],
      ],
    ]);

    const resolved = resolveFacilitiesSelectionGeometry(geometry);
    expect(resolved.bbox).toEqual({
      west: -97.8,
      south: 30.2,
      east: -97.6,
      north: 30.4,
    });
    expect(facilitiesSelectionBboxExceedsLimits(resolved.bbox)).toBe(false);
  });

  it("flags oversized polygon bbox spans", () => {
    const geometry = buildGeometry([
      [
        [-120, 30],
        [-110, 30],
        [-110, 40],
        [-120, 40],
        [-120, 30],
      ],
    ]);

    const resolved = resolveFacilitiesSelectionGeometry(geometry);
    expect(facilitiesSelectionBboxExceedsLimits(resolved.bbox)).toBe(true);
  });

  it("provides serialized geometry text for payload-size enforcement", () => {
    const geometry = buildGeometry([
      [
        [-97.8, 30.2],
        [-97.6, 30.2],
        [-97.6, 30.4],
        [-97.8, 30.4],
        [-97.8, 30.2],
      ],
    ]);

    const resolved = resolveFacilitiesSelectionGeometry(geometry);
    expect(resolved.geometryText.length).toBeGreaterThan(0);
    expect(FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS).toBeGreaterThan(0);
  });
});
