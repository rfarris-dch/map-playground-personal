import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
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
import type { MapInitErrorReason } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import {
  defaultBasemapStyleUrl,
  loadBasemapStyle,
  mountBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";

const DEFAULT_MAP_MAX_PITCH = 85;

export class AppShellMapInitError {
  readonly _tag = "AppShellMapInitError";
  readonly reason: MapInitErrorReason;
  readonly cause: unknown;

  constructor(reason: MapInitErrorReason, cause: unknown) {
    this.reason = reason;
    this.cause = cause;
  }
}

function classifyMapInitError(error: unknown): MapInitErrorReason {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const message = error.message.toLowerCase();
  const causeMessage = error.cause instanceof Error ? error.cause.message.toLowerCase() : "";

  if (
    message.includes("failed to load") ||
    message.includes("style") ||
    causeMessage.includes("fetch") ||
    causeMessage.includes("networkerror") ||
    causeMessage.includes("failed to fetch")
  ) {
    return "style-fetch";
  }

  if (
    message.includes("webgl") ||
    message.includes("failed to initialize") ||
    message.includes("canvas") ||
    message.includes("gl context") ||
    causeMessage.includes("webgl")
  ) {
    return "webgl";
  }

  return "init";
}

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
  readonly loadBasemapStyle: typeof loadBasemapStyle;
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
  loadBasemapStyle,
  mountBasemapLayerVisibility,
  registerPmtilesProtocolScoped,
};

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

function resolveInitialMapBearing(
  initialViewport: MapContextTransfer["viewport"] | undefined
): number | undefined {
  return initialViewport?.bearing;
}

function resolveInitialMapPitch(
  initialViewport: MapContextTransfer["viewport"] | undefined
): number | undefined {
  return initialViewport?.pitch;
}

export function createAppShellMapInitializer(
  dependencies: AppShellMapDependencies
): (
  container: HTMLDivElement,
  options?: AppShellMapInitializeOptions
) => Effect.Effect<AppShellMapSetup, AppShellMapInitError, Scope.Scope> {
  return (container, options = {}) =>
    Effect.gen(function* () {
      yield* dependencies.registerPmtilesProtocolScoped();
      const basemapStyle = yield* Effect.tryPromise({
        try: () => dependencies.loadBasemapStyle(dependencies.defaultBasemapStyleUrl()),
        catch: (error) => new AppShellMapInitError("style-fetch", error),
      });

      const initialBearing = resolveInitialMapBearing(options.initialViewport);
      const initialPitch = resolveInitialMapPitch(options.initialViewport);
      const mapCreateOptions = {
        antialias: true,
        style: basemapStyle,
        center: resolveInitialMapCenter(options.initialViewport),
        maxPitch: DEFAULT_MAP_MAX_PITCH,
        ...(typeof initialBearing === "number" ? { bearing: initialBearing } : {}),
        ...(typeof initialPitch === "number" ? { pitch: initialPitch } : {}),
        zoom: resolveInitialMapZoom(options.initialViewport),
        projection: { type: "mercator" },
      };

      const map = yield* dependencies
        .createMapScoped(dependencies.createMapLibreAdapter(), container, mapCreateOptions)
        .pipe(
          Effect.catchAllDefect((defect) =>
            Effect.fail(new AppShellMapInitError(classifyMapInitError(defect), defect))
          )
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
