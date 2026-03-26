import { afterEach, describe, expect, it, mock } from "bun:test";
import { createPmtilesSourceUrl } from "@map-migration/geo-tiles";
import { loadTilePublishManifest } from "@map-migration/geo-tiles/effect";
import { mountManifestBackedLayerBootstrap } from "@/lib/manifest-backed-layer.service";
import { FakeMap } from "../../support/fake-map";

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

function noop(): void {
  return;
}

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
    const fetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("https://tiles.example.com/tiles/parcels-draw-v1/latest.json");
      expect(init?.headers).toBeDefined();
      const headers = new Headers(init?.headers);
      expect(headers.get("accept")).toBe("application/json");
      expect(headers.has("x-request-id")).toBe(false);
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

  it("uses contextual manifest errors when bootstrapping manifest-backed layers", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("socket hang up")));

    const bootstrap = mountManifestBackedLayerBootstrap({
      contextLabel: "gas-pipelines",
      ensureLayers: mock(noop),
      ensureSource: mock(noop),
      manifestPath: "manifests/gas.json",
      map: new FakeMap(),
    });

    await expect(bootstrap.initializeSource()).rejects.toThrow(
      "[gas-pipelines] failed to load tile manifest"
    );
  });

  it("preserves the original network error cause when requested during bootstrap", async () => {
    const networkError = new Error("socket hang up");
    globalThis.fetch = mock(() => Promise.reject(networkError));

    const bootstrap = mountManifestBackedLayerBootstrap({
      contextLabel: "parcels",
      ensureLayers: mock(noop),
      ensureSource: mock(noop),
      manifestPath: "manifests/parcels.json",
      map: new FakeMap(),
      preserveNetworkErrorCause: true,
    });

    try {
      await bootstrap.initializeSource();
      throw new Error("Expected initializeSource to reject");
    } catch (error) {
      expect(error).toBe(networkError);
    }
  });
});
