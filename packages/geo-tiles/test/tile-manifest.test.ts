import { describe, expect, it } from "bun:test";
import { createManifestEntry, createPublishManifest, parseTilePublishManifest } from "@/index";

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
});
