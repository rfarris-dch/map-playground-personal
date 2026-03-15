import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const addProtocolMock = mock<(scheme: string, action: unknown) => void>();
const removeProtocolMock = mock<(scheme: string) => void>();
let lastMapOptions: Record<string, unknown> | null = null;

class ProtocolMock {
  tile() {
    return Promise.resolve(null);
  }
}

class MapMock {
  bearing = 0;
  center = { lat: 32, lng: -96 };
  pitch = 0;
  projection: unknown = null;
  removed = false;

  constructor(options?: Record<string, unknown>) {
    lastMapOptions = options ?? null;
  }

  addControl(): void {
    /* stub */
  }
  addLayer(): void {
    /* stub */
  }
  addSource(): void {
    /* stub */
  }
  getBounds() {
    return {
      getEast: () => -90,
      getNorth: () => 40,
      getSouth: () => 30,
      getWest: () => -100,
    };
  }
  getBearing() {
    return this.bearing;
  }
  getCenter() {
    return this.center;
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
  getPitch() {
    return this.pitch;
  }
  getZoom() {
    return 5;
  }
  isStyleLoaded() {
    return true;
  }
  off(): void {
    /* stub */
  }
  on(): void {
    /* stub */
  }
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
  removeControl(): void {
    /* stub */
  }
  removeLayer(): void {
    /* stub */
  }
  removeSource(): void {
    /* stub */
  }
  setFeatureState(): void {
    /* stub */
  }
  setLayoutProperty(): void {
    /* stub */
  }
  setProjection(projection: unknown): void {
    this.projection = projection;
  }
  setViewport(viewport: {
    readonly bearing?: number;
    readonly center?: [number, number];
    readonly pitch?: number;
    readonly type: "bounds" | "center";
    readonly zoom?: number;
  }): void {
    if (typeof viewport.bearing === "number") {
      this.bearing = viewport.bearing;
    }
    if (typeof viewport.pitch === "number") {
      this.pitch = viewport.pitch;
    }
    if (Array.isArray(viewport.center)) {
      this.center = {
        lng: viewport.center[0],
        lat: viewport.center[1],
      };
    }
  }
  setStyle(): void {
    /* stub */
  }
  setTerrain(): void {
    /* stub */
  }
}

class MarkerMock {
  addTo(): this {
    return this;
  }

  remove(): void {
    /* stub */
  }

  setLngLat(): this {
    return this;
  }
}

mock.module("maplibre-gl", () => ({
  FullscreenControl: class {},
  Marker: MarkerMock,
  NavigationControl: class {},
  ScaleControl: class {},
  addProtocol: addProtocolMock,
  default: {
    FullscreenControl: class {},
    Map: MapMock,
    Marker: MarkerMock,
    NavigationControl: class {},
    ScaleControl: class {},
  },
  removeProtocol: removeProtocolMock,
}));

mock.module("pmtiles", () => ({
  Protocol: ProtocolMock,
}));

const { createMap, createMapLibreAdapter, isZoomInRange, registerPmtilesProtocol } = await import(
  "@/index"
);

afterAll(() => {
  mock.restore();
});

describe("map-engine", () => {
  beforeEach(() => {
    addProtocolMock.mockReset();
    removeProtocolMock.mockReset();
    lastMapOptions = null;
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
    const map = {
      destroy() {
        return undefined;
      },
    };
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
      bearing: 25,
      center: [-96, 32],
      hash: true,
      maxPitch: 85,
      maxZoom: 18,
      minZoom: 3,
      pitch: 40,
      preserveDrawingBuffer: true,
      projection: { type: "mercator" },
      style: "mapbox://styles/test",
      transformRequest: (url) => ({ url }),
      zoom: 6,
    });

    await Promise.resolve();

    expect(lastMapOptions).toMatchObject({
      bearing: 25,
      hash: true,
      maxPitch: 85,
      maxZoom: 18,
      minZoom: 3,
      pitch: 40,
      style: "mapbox://styles/test",
      zoom: 6,
    });
    expect(map.getProjection()).toEqual({ type: "mercator" });
    expect(isZoomInRange(6, 3, 10)).toBe(true);
    expect(isZoomInRange(2, 3, 10)).toBe(false);

    map.destroy();
  });
});
