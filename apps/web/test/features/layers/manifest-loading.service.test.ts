import { afterEach, describe, expect, it, mock } from "bun:test";
import { createPmtilesSourceUrl } from "@map-migration/geo-tiles";
import { loadTilePublishManifest } from "@map-migration/geo-tiles/effect";

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

  it("resolves relative PMTiles asset paths against the manifest origin", async () => {
    const fetchMock = mock((input: RequestInfo | URL) => {
      expect(input).toBe("https://tiles.example.com/tiles/parcels-draw-v1/latest.json");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...validManifest,
            current: {
              ...validManifest.current,
              url: "20260308.deadbeef.pmtiles",
            },
          }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          }
        )
      );
    });

    globalThis.fetch = fetchMock;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "https://app.example.com",
        },
      },
    });

    const manifest = await loadTilePublishManifest({
      contextLabel: "parcels",
      manifestPath: "https://tiles.example.com/tiles/parcels-draw-v1/latest.json",
    });

    expect(manifest.current.version).toBe("20260308.deadbeef");
    expect(
      createPmtilesSourceUrl(
        manifest,
        "https://tiles.example.com/tiles/parcels-draw-v1/latest.json"
      )
    ).toBe("pmtiles://https://tiles.example.com/tiles/parcels-draw-v1/20260308.deadbeef.pmtiles");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
