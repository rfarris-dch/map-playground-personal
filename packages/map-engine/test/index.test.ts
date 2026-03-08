import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const addProtocolMock = mock<(scheme: string, action: unknown) => void>();
const removeProtocolMock = mock<(scheme: string) => void>();

class ProtocolMock {
  tile() {
    return Promise.resolve(null);
  }
}

class MapMock {
  public projection: unknown = null;
  public removed = false;

  addControl(): void {}
  addLayer(): void {}
  addSource(): void {}
  getBounds() {
    return {
      getEast: () => -90,
      getNorth: () => 40,
      getSouth: () => 30,
      getWest: () => -100,
    };
  }
  getCanvas() {
    return {
      toBlob(callback: (blob: Blob | null) => void) {
        callback(new Blob());
      },
    };
  }
  getContainer() {
    return {
      clientHeight: 600,
      clientWidth: 800,
    };
  }
  getLayer() {
    return undefined;
  }
  getProjection() {
    return this.projection;
  }
  getSource() {
    return undefined;
  }
  getStyle() {
    return { version: 8 };
  }
  getZoom() {
    return 5;
  }
  isStyleLoaded() {
    return true;
  }
  off(): void {}
  on(): void {}
  project() {
    return {
      x: 10,
      y: 20,
    };
  }
  queryRenderedFeatures() {
    return [];
  }
  remove() {
    this.removed = true;
  }
  removeControl(): void {}
  removeLayer(): void {}
  removeSource(): void {}
  setFeatureState(): void {}
  setLayoutProperty(): void {}
  setProjection(projection: unknown): void {
    this.projection = projection;
  }
  setStyle(): void {}
  setTerrain(): void {}
}

mock.module("maplibre-gl", () => ({
  FullscreenControl: class {},
  NavigationControl: class {},
  ScaleControl: class {},
  addProtocol: addProtocolMock,
  default: {
    FullscreenControl: class {},
    Map: MapMock,
    NavigationControl: class {},
    ScaleControl: class {},
  },
  removeProtocol: removeProtocolMock,
}));

mock.module("pmtiles", () => ({
  Protocol: ProtocolMock,
}));

const { createMap, createMapLibreAdapter, isZoomInRange, registerPmtilesProtocol } =
  await import("@/index");

afterAll(() => {
  mock.restore();
});

describe("map-engine", () => {
  beforeEach(() => {
    addProtocolMock.mockReset();
    removeProtocolMock.mockReset();
  });

  it("reference-counts the PMTiles protocol registration", () => {
    const disposeFirst = registerPmtilesProtocol();
    const disposeSecond = registerPmtilesProtocol();

    expect(addProtocolMock).toHaveBeenCalledTimes(1);
    expect(addProtocolMock).toHaveBeenCalledWith("pmtiles", expect.any(Function));

    disposeFirst();
    expect(removeProtocolMock).not.toHaveBeenCalled();

    disposeSecond();
    expect(removeProtocolMock).toHaveBeenCalledTimes(1);
    expect(removeProtocolMock).toHaveBeenCalledWith("pmtiles");

    disposeSecond();
    expect(removeProtocolMock).toHaveBeenCalledTimes(1);
  });

  it("delegates createMap to the provided adapter", () => {
    const map = { destroy() {} };
    const createMapMock = mock(() => map);
    const container = {} as HTMLElement;
    const options = {
      center: [-97, 30] as [number, number],
      style: "mapbox://styles/test",
      zoom: 4,
    };

    const result = createMap(
      {
        createMap: createMapMock,
      },
      container,
      options
    );

    expect(result).toBe(map);
    expect(createMapMock).toHaveBeenCalledWith(container, options);
  });

  it("maps MapLibre options and applies projections through the adapter", async () => {
    const adapter = createMapLibreAdapter();
    const map = adapter.createMap({} as HTMLElement, {
      center: [-96, 32],
      hash: true,
      maxZoom: 18,
      minZoom: 3,
      preserveDrawingBuffer: true,
      projection: { type: "mercator" },
      style: "mapbox://styles/test",
      transformRequest: (url) => ({ url }),
      zoom: 6,
    });

    await Promise.resolve();

    expect(map.getProjection()).toEqual({ type: "mercator" });
    expect(isZoomInRange(6, 3, 10)).toBe(true);
    expect(isZoomInRange(2, 3, 10)).toBe(false);

    map.destroy();
  });
});
