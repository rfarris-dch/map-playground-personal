import { describe, expect, it } from "bun:test";
import { ParcelEnrichRequestSchema } from "@/index";

describe("parcel AOI contracts", () => {
  it("accepts a valid bbox AOI", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "bbox",
        bbox: {
          west: -97.9,
          south: 30.1,
          east: -97.6,
          north: 30.5,
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects inverted bbox ordering", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "bbox",
        bbox: {
          west: 10,
          south: 30,
          east: -10,
          north: 31,
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects bbox coordinates outside world bounds", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "bbox",
        bbox: {
          west: -190,
          south: 30,
          east: -97,
          north: 31,
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts tileSet coordinates inside z-range", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "tileSet",
        z: 3,
        tiles: [
          { x: 0, y: 0 },
          { x: 7, y: 7 },
        ],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a closed polygon AOI", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "polygon",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-97.9, 30.1],
              [-97.6, 30.1],
              [-97.6, 30.5],
              [-97.9, 30.1],
            ],
          ],
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects polygon AOIs with an open ring", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "polygon",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-97.9, 30.1],
              [-97.6, 30.1],
              [-97.6, 30.5],
              [-97.9, 30.4],
            ],
          ],
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects tileSet x/y out of range for z", () => {
    const parsed = ParcelEnrichRequestSchema.safeParse({
      aoi: {
        type: "tileSet",
        z: 10,
        tiles: [
          { x: 1024, y: 0 },
          { x: 0, y: 2048 },
        ],
      },
    });

    expect(parsed.success).toBe(false);
  });
});
