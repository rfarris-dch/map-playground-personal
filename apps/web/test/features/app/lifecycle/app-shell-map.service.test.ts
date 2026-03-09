import { describe, expect, it } from "bun:test";
import type { MapControl, MapRequestParameters } from "@map-migration/map-engine";
import { Effect, Exit, Scope } from "effect";
import {
  type AppShellMapDependencies,
  createAppShellMapInitializer,
} from "@/features/app/lifecycle/app-shell-map.service";
import { createTestMapControl, FakeMap } from "../../../support/fake-map";

function noop(): void {
  /* noop */
}

describe("app-shell-map service", () => {
  it("creates the map with the current PMTiles, control, viewport, and glyph-rewrite behavior", async () => {
    const fakeMap = new FakeMap();
    const controls = {
      fullscreen: createTestMapControl("fullscreen"),
      navigation: createTestMapControl("navigation"),
      scale: createTestMapControl("scale"),
    };
    const calls = {
      adapterCreated: 0,
      basemapDestroyed: false,
      createMapOptions: null as MapRequestParameters | null,
      disposePmtilesProtocolCalled: false,
      navigationControlOptions: null as Record<string, unknown> | null,
    };
    const basemapLayerController = {
      destroy() {
        calls.basemapDestroyed = true;
      },
      setVisible: noop,
    };

    const dependencies: AppShellMapDependencies = {
      createFullscreenControl() {
        return controls.fullscreen;
      },
      createMapScoped(adapter, _container, options) {
        return Effect.acquireRelease(
          Effect.sync(() => {
            expect(adapter).toEqual({
              adapterId: "maplibre-test-adapter",
            });
            calls.createMapOptions =
              options.transformRequest?.("https://tiles.openfreemap.org/fonts/Inter/0-255.pbf") ??
              null;
            expect(options.style).toBe("mapbox://styles/test-style");
            expect(options.center[0]).toBeCloseTo(-96.8, 10);
            expect(options.center[1]).toBeCloseTo(32.75, 10);
            expect(options.maxPitch).toBe(85);
            expect(options.zoom).toBe(3.2);
            expect(options.projection).toEqual({ type: "mercator" });
            expect(options.preserveDrawingBuffer).toBe(true);
            return fakeMap;
          }),
          () =>
            Effect.sync(() => {
              fakeMap.destroy();
            })
        );
      },
      createMapLibreAdapter() {
        calls.adapterCreated += 1;
        return {
          adapterId: "maplibre-test-adapter",
        };
      },
      createNavigationControl(options) {
        calls.navigationControlOptions = options;
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
      registerPmtilesProtocolScoped() {
        return Effect.acquireRelease(
          Effect.sync(() => undefined),
          () =>
            Effect.sync(() => {
              calls.disposePmtilesProtocolCalled = true;
            })
        );
      },
    };

    const initializeMap = createAppShellMapInitializer(dependencies);
    const scope = await Effect.runPromise(Scope.make());

    try {
      const setup = await Effect.runPromise(
        Scope.extend(
          initializeMap({} as HTMLDivElement, {
            initialViewport: {
              type: "bounds",
              bounds: {
                west: -97.4,
                south: 32.3,
                east: -96.2,
                north: 33.2,
              },
            },
          }),
          scope
        )
      );

      expect(calls.adapterCreated).toBe(1);
      expect(calls.createMapOptions).toEqual({
        url: "https://demotiles.maplibre.org/font/Inter/0-255.pbf",
      });
      expect(fakeMap.addControlCalls).toEqual([
        { control: controls.navigation, position: "top-right" },
        { control: controls.scale, position: "bottom-right" },
        { control: controls.fullscreen, position: "top-right" },
      ]);
      expect(calls.navigationControlOptions).toEqual({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      });
      expect(setup.map).toBe(fakeMap);
      expect(setup.basemapLayerController).toBe(basemapLayerController);
    } finally {
      await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
    }

    expect(fakeMap.removedControls).toEqual([
      controls.navigation,
      controls.scale,
      controls.fullscreen,
    ] satisfies readonly MapControl[]);
    expect(fakeMap.destroyed).toBe(true);
    expect(calls.basemapDestroyed).toBe(true);
    expect(calls.disposePmtilesProtocolCalled).toBe(true);
  });
});
