import { describe, expect, it } from "bun:test";
import {
  buildFacilitiesBboxCacheKey,
  buildFacilitiesDetailCacheKey,
  buildFacilitiesSelectionCacheKey,
} from "@/geo/facilities/route/facilities-cache-key.service";

describe("facilities cache key service", () => {
  it("canonicalizes bbox keys across small floating point differences", () => {
    const left = buildFacilitiesBboxCacheKey({
      bbox: {
        west: -97.743_19,
        south: 30.267_21,
        east: -97.743_01,
        north: 30.267_31,
      },
      dataVersion: "dv-test",
      limit: 2000,
      perspective: "colocation",
    });
    const right = buildFacilitiesBboxCacheKey({
      bbox: {
        west: -97.743_11,
        south: 30.267_29,
        east: -97.743_09,
        north: 30.267_39,
      },
      dataVersion: "dv-test",
      limit: 2000,
      perspective: "colocation",
    });

    expect(left).toBe(right);
    expect(left).toContain("facilities:bbox:v2:dv-test:colocation:2000:");
  });

  it("builds detail keys with perspective and facility id", () => {
    expect(
      buildFacilitiesDetailCacheKey({
        dataVersion: "dv-test",
        facilityId: "colo:123",
        perspective: "colocation",
      })
    ).toBe("facilities:detail:v1:dv-test:colocation:colo%3A123");
  });

  it("normalizes selection keys across perspective ordering", async () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [-97.75, 30.25],
          [-97.7, 30.25],
          [-97.7, 30.3],
          [-97.75, 30.3],
          [-97.75, 30.25],
        ],
      ],
    };

    const left = await buildFacilitiesSelectionCacheKey({
      dataVersion: "dv-test",
      geometry,
      limitPerPerspective: 5000,
      perspectives: ["hyperscale", "colocation", "hyperscale"],
    });
    const right = await buildFacilitiesSelectionCacheKey({
      dataVersion: "dv-test",
      geometry,
      limitPerPerspective: 5000,
      perspectives: ["colocation", "hyperscale"],
    });

    expect(left).toBe(right);
    expect(left).toContain("facilities:selection:v1:dv-test:");
  });
});
