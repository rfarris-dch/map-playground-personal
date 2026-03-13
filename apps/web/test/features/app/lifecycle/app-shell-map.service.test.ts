import { describe, expect, it } from "bun:test";
import type { MapControl } from "@map-migration/map-engine";
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
            expect(options.style).toEqual({
              version: 8,
              sources: {},
              layers: [],
            });
            expect(options.antialias).toBe(true);
            expect(options.center[0]).toBeCloseTo(-96.8, 10);
            expect(options.center[1]).toBeCloseTo(32.75, 10);
            expect(options.maxPitch).toBe(85);
            expect(options.zoom).toBe(3.2);
            expect(options.projection).toEqual({ type: "mercator" });
            expect(options.preserveDrawingBuffer).toBeUndefined();
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
      loadBasemapStyle(styleUrl) {
        expect(styleUrl).toBe("mapbox://styles/test-style");
        return Promise.resolve({
          version: 8,
          sources: {},
          layers: [],
        });
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

  it("passes center viewport camera settings through map initialization", async () => {
    const fakeMap = new FakeMap();
    let capturedOptions: Record<string, unknown> | null = null;

    const dependencies: AppShellMapDependencies = {
      createFullscreenControl() {
        return createTestMapControl("fullscreen");
      },
      createMapScoped(_adapter, _container, options) {
        return Effect.acquireRelease(
          Effect.sync(() => {
            capturedOptions = options;
            return fakeMap;
          }),
          () =>
            Effect.sync(() => {
              fakeMap.destroy();
            })
        );
      },
      createMapLibreAdapter() {
        return {
          adapterId: "maplibre-test-adapter",
        };
      },
      createNavigationControl() {
        return createTestMapControl("navigation");
      },
      createScaleControl() {
        return createTestMapControl("scale");
      },
      defaultBasemapStyleUrl() {
        return "mapbox://styles/test-style";
      },
      loadBasemapStyle(styleUrl) {
        expect(styleUrl).toBe("mapbox://styles/test-style");
        return Promise.resolve({
          version: 8,
          sources: {},
          layers: [],
        });
      },
      mountBasemapLayerVisibility() {
        return {
          destroy: noop,
          setVisible: noop,
        };
      },
      registerPmtilesProtocolScoped() {
        return Effect.acquireRelease(
          Effect.sync(() => undefined),
          () => Effect.void
        );
      },
    };

    const initializeMap = createAppShellMapInitializer(dependencies);
    const scope = await Effect.runPromise(Scope.make());

    try {
      await Effect.runPromise(
        Scope.extend(
          initializeMap({} as HTMLDivElement, {
            initialViewport: {
              bearing: 22,
              center: [-95.5, 29.75],
              pitch: 48,
              type: "center",
              zoom: 8.4,
            },
          }),
          scope
        )
      );
    } finally {
      await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
    }

    expect(capturedOptions).toMatchObject({
      antialias: true,
      bearing: 22,
      center: [-95.5, 29.75],
      pitch: 48,
      zoom: 8.4,
    });
  });
});
