import type { MapContextTransfer } from "@map-migration/contracts";
import {
  createFullscreenControl,
  createMap,
  createMapLibreAdapter,
  createNavigationControl,
  createScaleControl,
  type IMap,
  type MapControl,
  registerPmtilesProtocol,
} from "@map-migration/map-engine";
import {
  defaultBasemapStyleUrl,
  mountBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";

const OPENFREEMAP_GLYPHS_PREFIX = "https://tiles.openfreemap.org/fonts/";
const MAPLIBRE_DEMOTILES_GLYPHS_PREFIX = "https://demotiles.maplibre.org/font/";

export interface AppShellMapSetup {
  readonly basemapLayerController: BasemapLayerVisibilityController;
  readonly controls: readonly MapControl[];
  readonly disposePmtilesProtocol: () => void;
  readonly map: IMap;
}

interface AppShellMapInitializeOptions {
  readonly initialViewport?: MapContextTransfer["viewport"];
}

export interface AppShellMapDependencies {
  readonly createFullscreenControl: typeof createFullscreenControl;
  readonly createMap: typeof createMap;
  readonly createMapLibreAdapter: typeof createMapLibreAdapter;
  readonly createNavigationControl: typeof createNavigationControl;
  readonly createScaleControl: typeof createScaleControl;
  readonly defaultBasemapStyleUrl: typeof defaultBasemapStyleUrl;
  readonly mountBasemapLayerVisibility: typeof mountBasemapLayerVisibility;
  readonly registerPmtilesProtocol: typeof registerPmtilesProtocol;
}

const defaultAppShellMapDependencies: AppShellMapDependencies = {
  createFullscreenControl,
  createMap,
  createMapLibreAdapter,
  createNavigationControl,
  createScaleControl,
  defaultBasemapStyleUrl,
  mountBasemapLayerVisibility,
  registerPmtilesProtocol,
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
  });
  const scaleControl = dependencies.createScaleControl({ maxWidth: 140, unit: "imperial" });
  const fullscreenControl = dependencies.createFullscreenControl();

  const controls: MapControl[] = [navigationControl, scaleControl, fullscreenControl];

  nextMap.addControl(navigationControl, "top-right");
  nextMap.addControl(scaleControl, "bottom-right");
  nextMap.addControl(fullscreenControl, "top-right");

  return controls;
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
): (container: HTMLDivElement, options?: AppShellMapInitializeOptions) => AppShellMapSetup {
  return (container, options = {}) => {
    const disposePmtilesProtocol = dependencies.registerPmtilesProtocol();
    const map = dependencies.createMap(dependencies.createMapLibreAdapter(), container, {
      style: dependencies.defaultBasemapStyleUrl(),
      center: resolveInitialMapCenter(options.initialViewport),
      preserveDrawingBuffer: true,
      zoom: resolveInitialMapZoom(options.initialViewport),
      projection: { type: "mercator" },
      transformRequest: (url) => {
        const rewrittenUrl = rewriteGlyphRequestUrl(url);
        if (rewrittenUrl === url) {
          return undefined;
        }

        return { url: rewrittenUrl };
      },
    });

    return {
      map,
      controls: mountMapControls(map, dependencies),
      basemapLayerController: dependencies.mountBasemapLayerVisibility(map),
      disposePmtilesProtocol,
    };
  };
}

export const initializeAppShellMap = createAppShellMapInitializer(defaultAppShellMapDependencies);

export function suppressMapLibreGlyphWarnings(): () => void {
  return (): void => {
    // Map initialization no longer patches console.warn globally.
  };
}
