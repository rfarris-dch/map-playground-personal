import { afterEach, describe, expect, it, mock } from "bun:test";
import { createPmtilesSourceUrl } from "@map-migration/geo-tiles";
import { loadTilePublishManifest } from "@map-migration/geo-tiles/effect";
import { loadParcelsManifest } from "@/features/parcels/parcels.service";

const validManifest = {
  dataset: "parcels-draw-v1",
  publishedAt: "2026-03-08T00:00:00.000Z",
  current: {
    dataset: "parcels-draw-v1",
    version: "20260308.deadbeef",
    checksum: "deadbeef",
    url: "/tiles/parcels/20260308.deadbeef.pmtiles",
  },
  previous: null,
};

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("manifest loading services", () => {
  it("keeps vector-tile manifest network errors mapped to the current contextual message", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("socket hang up")));

    await expect(
      loadTilePublishManifest({
        contextLabel: "flood",
        manifestPath: "manifests/flood.json",
      })
    ).rejects.toThrow("[flood] failed to load tile manifest");
  });

  it("keeps parcels manifest network errors surfaced as the original thrown error", async () => {
    const thrown = new Error("socket hang up");
    globalThis.fetch = mock(() => Promise.reject(thrown));

    await expect(
      loadParcelsManifest({
        manifestPath: "manifests/parcels.json",
      })
    ).rejects.toBe(thrown);
  });

  it("normalizes relative manifest paths and PMTiles asset URLs for both manifest consumers", async () => {
    const fetchMock = mock((input: RequestInfo | URL) => {
      expect(input).toBe("/manifests/parcels.json");
      return Promise.resolve(
        new Response(JSON.stringify(validManifest), {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        })
      );
    });

    globalThis.fetch = fetchMock;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "https://example.com",
        },
      },
    });

    const parcelsManifest = await loadParcelsManifest({
      manifestPath: "manifests/parcels.json",
    });
    const vectorManifest = await loadTilePublishManifest({
      contextLabel: "parcels",
      manifestPath: "manifests/parcels.json",
    });

    expect(parcelsManifest.current.version).toBe("20260308.deadbeef");
    expect(vectorManifest.current.version).toBe("20260308.deadbeef");
    expect(createPmtilesSourceUrl(parcelsManifest)).toBe(
      "pmtiles://https://example.com/tiles/parcels/20260308.deadbeef.pmtiles"
    );
    expect(createPmtilesSourceUrl(vectorManifest)).toBe(
      "pmtiles://https://example.com/tiles/parcels/20260308.deadbeef.pmtiles"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
