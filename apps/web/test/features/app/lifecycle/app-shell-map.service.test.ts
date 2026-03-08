import { describe, expect, it } from "bun:test";
import type { MapControl, MapRequestParameters } from "@map-migration/map-engine";
import {
  type AppShellMapDependencies,
  createAppShellMapInitializer,
} from "@/features/app/lifecycle/app-shell-map.service";
import { createTestMapControl, FakeMap } from "../../../support/fake-map";

function noop(): void {
  /* noop */
}

describe("app-shell-map service", () => {
  it("creates the map with the current PMTiles, control, viewport, and glyph-rewrite behavior", () => {
    const fakeMap = new FakeMap();
    const controls = {
      fullscreen: createTestMapControl("fullscreen"),
      navigation: createTestMapControl("navigation"),
      scale: createTestMapControl("scale"),
    };
    const basemapLayerController = {
      destroy: noop,
      setVisible: noop,
    };
    const calls: {
      adapterCreated: number;
      createMapOptions: MapRequestParameters | null;
      disposePmtilesProtocolCalled: boolean;
    } = {
      adapterCreated: 0,
      createMapOptions: null,
      disposePmtilesProtocolCalled: false,
    };

    const dependencies: AppShellMapDependencies = {
      createFullscreenControl() {
        return controls.fullscreen;
      },
      createMap(adapter, _container, options) {
        expect(adapter).toEqual({
          adapterId: "maplibre-test-adapter",
        });
        calls.createMapOptions =
          options.transformRequest?.("https://tiles.openfreemap.org/fonts/Inter/0-255.pbf") ?? null;
        expect(options.style).toBe("mapbox://styles/test-style");
        expect(options.center[0]).toBeCloseTo(-96.8, 10);
        expect(options.center[1]).toBeCloseTo(32.75, 10);
        expect(options.zoom).toBe(3.2);
        expect(options.projection).toEqual({ type: "mercator" });
        expect(options.preserveDrawingBuffer).toBe(true);
        return fakeMap;
      },
      createMapLibreAdapter() {
        calls.adapterCreated += 1;
        return {
          adapterId: "maplibre-test-adapter",
        };
      },
      createNavigationControl() {
        return controls.navigation;
      },
      createScaleControl() {
        return controls.scale;
      },
      defaultBasemapStyleUrl() {
        return "mapbox://styles/test-style";
      },
      mountBasemapLayerVisibility(map) {
        expect(map).toBe(fakeMap);
        return basemapLayerController;
      },
      registerPmtilesProtocol() {
        return () => {
          calls.disposePmtilesProtocolCalled = true;
        };
      },
    };

    const initializeMap = createAppShellMapInitializer(dependencies);
    const setup = initializeMap({} as HTMLDivElement, {
      initialViewport: {
        type: "bounds",
        bounds: {
          west: -97.4,
          south: 32.3,
          east: -96.2,
          north: 33.2,
        },
      },
    });

    expect(calls.adapterCreated).toBe(1);
    expect(calls.createMapOptions).toEqual({
      url: "https://demotiles.maplibre.org/font/Inter/0-255.pbf",
    });
    expect(fakeMap.addControlCalls).toEqual([
      { control: controls.navigation, position: "top-right" },
      { control: controls.scale, position: "bottom-right" },
      { control: controls.fullscreen, position: "top-right" },
    ]);
    expect(setup.map).toBe(fakeMap);
    expect(setup.controls).toEqual([
      controls.navigation,
      controls.scale,
      controls.fullscreen,
    ] satisfies readonly MapControl[]);
    expect(setup.basemapLayerController).toBe(basemapLayerController);

    setup.disposePmtilesProtocol();
    expect(calls.disposePmtilesProtocolCalled).toBe(true);
  });
});
