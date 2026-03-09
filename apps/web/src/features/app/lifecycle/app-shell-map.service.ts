import type { MapContextTransfer } from "@map-migration/contracts";
import {
  createFullscreenControl,
  createMapLibreAdapter,
  createNavigationControl,
  createScaleControl,
  type IMap,
  type MapControl,
} from "@map-migration/map-engine";
import { createMapScoped, registerPmtilesProtocolScoped } from "@map-migration/map-engine/effect";
import { Effect, type Scope } from "effect";
import {
  defaultBasemapStyleUrl,
  mountBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";

const OPENFREEMAP_GLYPHS_PREFIX = "https://tiles.openfreemap.org/fonts/";
const MAPLIBRE_DEMOTILES_GLYPHS_PREFIX = "https://demotiles.maplibre.org/font/";
const DEFAULT_MAP_MAX_PITCH = 85;

export interface AppShellMapSetup {
  readonly basemapLayerController: BasemapLayerVisibilityController;
  readonly map: IMap;
}

interface AppShellMapInitializeOptions {
  readonly initialViewport?: MapContextTransfer["viewport"];
}

export interface AppShellMapDependencies {
  readonly createFullscreenControl: typeof createFullscreenControl;
  readonly createMapLibreAdapter: typeof createMapLibreAdapter;
  readonly createMapScoped: typeof createMapScoped;
  readonly createNavigationControl: typeof createNavigationControl;
  readonly createScaleControl: typeof createScaleControl;
  readonly defaultBasemapStyleUrl: typeof defaultBasemapStyleUrl;
  readonly mountBasemapLayerVisibility: typeof mountBasemapLayerVisibility;
  readonly registerPmtilesProtocolScoped: typeof registerPmtilesProtocolScoped;
}

const defaultAppShellMapDependencies: AppShellMapDependencies = {
  createFullscreenControl,
  createMapScoped,
  createMapLibreAdapter,
  createNavigationControl,
  createScaleControl,
  defaultBasemapStyleUrl,
  mountBasemapLayerVisibility,
  registerPmtilesProtocolScoped,
};

function rewriteGlyphRequestUrl(url: string): string {
  if (!url.startsWith(OPENFREEMAP_GLYPHS_PREFIX)) {
    return url;
  }

  return `${MAPLIBRE_DEMOTILES_GLYPHS_PREFIX}${url.slice(OPENFREEMAP_GLYPHS_PREFIX.length)}`;
}

function mountMapControls(
  nextMap: IMap,
  dependencies: AppShellMapDependencies
): readonly MapControl[] {
  const navigationControl = dependencies.createNavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true,
  });
  const scaleControl = dependencies.createScaleControl({ maxWidth: 140, unit: "imperial" });
  const fullscreenControl = dependencies.createFullscreenControl();

  const controls: MapControl[] = [navigationControl, scaleControl, fullscreenControl];

  nextMap.addControl(navigationControl, "top-right");
  nextMap.addControl(scaleControl, "bottom-right");
  nextMap.addControl(fullscreenControl, "top-right");

  return controls;
}

function mountMapControlsScoped(map: IMap, dependencies: AppShellMapDependencies) {
  return Effect.acquireRelease(
    Effect.sync(() => mountMapControls(map, dependencies)),
    (controls) =>
      Effect.sync(() => {
        for (const control of controls) {
          map.removeControl(control);
        }
      })
  );
}

function mountBasemapLayerVisibilityScoped(map: IMap, dependencies: AppShellMapDependencies) {
  return Effect.acquireRelease(
    Effect.sync(() => dependencies.mountBasemapLayerVisibility(map)),
    (controller) =>
      Effect.sync(() => {
        controller.destroy();
      })
  );
}

function resolveInitialMapCenter(
  initialViewport: MapContextTransfer["viewport"] | undefined
): [number, number] {
  if (typeof initialViewport === "undefined") {
    return [-98.5795, 39.8283];
  }

  if (initialViewport.type === "center") {
    return initialViewport.center;
  }

  const longitudeSpan = initialViewport.bounds.east - initialViewport.bounds.west;
  const latitudeSpan = initialViewport.bounds.north - initialViewport.bounds.south;

  return [
    initialViewport.bounds.west + longitudeSpan / 2,
    initialViewport.bounds.south + latitudeSpan / 2,
  ];
}

function resolveInitialMapZoom(
  initialViewport: MapContextTransfer["viewport"] | undefined
): number {
  if (typeof initialViewport === "undefined" || initialViewport.type !== "center") {
    return 3.2;
  }

  return initialViewport.zoom;
}

export function createAppShellMapInitializer(
  dependencies: AppShellMapDependencies
): (
  container: HTMLDivElement,
  options?: AppShellMapInitializeOptions
) => Effect.Effect<AppShellMapSetup, never, Scope.Scope> {
  return (container, options = {}) =>
    Effect.gen(function* () {
      yield* dependencies.registerPmtilesProtocolScoped();

      const map = yield* dependencies.createMapScoped(
        dependencies.createMapLibreAdapter(),
        container,
        {
          style: dependencies.defaultBasemapStyleUrl(),
          center: resolveInitialMapCenter(options.initialViewport),
          preserveDrawingBuffer: true,
          maxPitch: DEFAULT_MAP_MAX_PITCH,
          zoom: resolveInitialMapZoom(options.initialViewport),
          projection: { type: "mercator" },
          transformRequest: (url) => {
            const rewrittenUrl = rewriteGlyphRequestUrl(url);
            if (rewrittenUrl === url) {
              return undefined;
            }

            return { url: rewrittenUrl };
          },
        }
      );

      yield* mountMapControlsScoped(map, dependencies);
      const basemapLayerController = yield* mountBasemapLayerVisibilityScoped(map, dependencies);

      return {
        map,
        basemapLayerController,
      } satisfies AppShellMapSetup;
    });
}

export const initializeAppShellMapEffect = createAppShellMapInitializer(
  defaultAppShellMapDependencies
);
