import { describe, expect, it } from "bun:test";
import {
  createPmtilesSourceUrl,
  createManifestEntry,
  createPublishManifest,
  decodeTilePublishManifest,
  normalizeManifestPath,
  normalizePmtilesAssetUrl,
  parseTileDataset,
  parseTilePublishManifest,
} from "@/index";

describe("geo-tiles publish manifest invariants", () => {
  it("rejects parsed manifests whose entries do not match the manifest dataset", () => {
    expect(() =>
      parseTilePublishManifest({
        dataset: "parcels-draw-v1",
        publishedAt: "2026-03-05T00:00:00.000Z",
        current: {
          dataset: "power",
          version: "20260305.deadbeef",
          checksum: "deadbeef",
          url: "/tiles/power/20260305.deadbeef.pmtiles",
        },
        previous: null,
      })
    ).toThrow('expected current manifest dataset "parcels-draw-v1"');
  });

  it("rejects created manifests whose entries do not match the requested dataset", () => {
    const wrongCurrent = createManifestEntry(
      "power",
      new Date("2026-03-05T00:00:00.000Z"),
      "deadbeef"
    );

    expect(() => createPublishManifest("parcels-draw-v1", wrongCurrent, null)).toThrow(
      'expected current manifest dataset "parcels-draw-v1"'
    );
  });

  it("accepts environmental overlay tile datasets", () => {
    expect(parseTileDataset("environmental-flood")).toBe("environmental-flood");
    expect(parseTileDataset("environmental-hydro-basins")).toBe("environmental-hydro-basins");
  });

  it("provides non-throwing manifest decode helpers and shared URL normalization", () => {
    const decoded = decodeTilePublishManifest({
      dataset: "parcels-draw-v1",
      publishedAt: "2026-03-08T00:00:00.000Z",
      current: {
        dataset: "parcels-draw-v1",
        version: "20260308.deadbeef",
        checksum: "deadbeef",
        url: "tiles/parcels/20260308.deadbeef.pmtiles",
      },
      previous: null,
    });

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      throw new Error(decoded.message);
    }

    expect(normalizeManifestPath("manifests/parcels.json")).toBe("/manifests/parcels.json");
    expect(normalizePmtilesAssetUrl("tiles/parcels.pmtiles", "https://example.com")).toBe(
      "https://example.com/tiles/parcels.pmtiles"
    );
    expect(createPmtilesSourceUrl(decoded.value, "https://example.com")).toBe(
      "pmtiles://https://example.com/tiles/parcels/20260308.deadbeef.pmtiles"
    );
  });
});
