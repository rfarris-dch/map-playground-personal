import { describe, expect, it } from "bun:test";
import { MapContextTransferSchema } from "@/index";

describe("map context transfer contracts", () => {
  it("accepts a center-based transfer payload", () => {
    const parsed = MapContextTransferSchema.safeParse({
      schemaVersion: 1,
      sourceSurface: "global-map",
      targetSurface: "market-map",
      marketIds: ["dal"],
      activePerspectives: ["colocation"],
      visibleLayerIds: ["facilities.colocation", "fiber-locator.metro"],
      visibleBasemapLayerIds: ["labels", "roads"],
      selectedBoundaryIds: {
        state: ["tx"],
      },
      selectedFiberSourceLayerNames: {
        metro: ["att"],
      },
      viewport: {
        bearing: 25,
        type: "center",
        center: [-96.797, 32.7767],
        pitch: 45,
        zoom: 8.2,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a bounds-based transfer payload", () => {
    const parsed = MapContextTransferSchema.safeParse({
      schemaVersion: 1,
      sourceSurface: "market-dashboard",
      targetSurface: "company-map",
      companyIds: ["company-123"],
      viewport: {
        bearing: 5,
        type: "bounds",
        bounds: {
          west: -97.2,
          south: 32.5,
          east: -96.4,
          north: 33.0,
        },
        pitch: 20,
      },
      highlightTarget: {
        kind: "company",
        id: "company-123",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid zoom values", () => {
    const parsed = MapContextTransferSchema.safeParse({
      schemaVersion: 1,
      sourceSurface: "global-map",
      targetSurface: "global-map",
      viewport: {
        type: "center",
        center: [-96.797, 32.7767],
        zoom: 30,
      },
    });

    expect(parsed.success).toBe(false);
  });
});
