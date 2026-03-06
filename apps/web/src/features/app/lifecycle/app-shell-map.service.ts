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
const OPENMAPTILES_GLYPHS_PREFIX = "https://fonts.openmaptiles.org/";

export interface AppShellMapSetup {
  readonly basemapLayerController: BasemapLayerVisibilityController;
  readonly controls: readonly MapControl[];
  readonly disposePmtilesProtocol: () => void;
  readonly map: IMap;
}

function rewriteGlyphRequestUrl(url: string): string {
  if (!url.startsWith(OPENFREEMAP_GLYPHS_PREFIX)) {
    return url;
  }

  return `${OPENMAPTILES_GLYPHS_PREFIX}${url.slice(OPENFREEMAP_GLYPHS_PREFIX.length)}`;
}

function mountMapControls(nextMap: IMap): readonly MapControl[] {
  const navigationControl = createNavigationControl({
    showCompass: true,
    showZoom: true,
  });
  const scaleControl = createScaleControl({ maxWidth: 140, unit: "imperial" });
  const fullscreenControl = createFullscreenControl();

  const controls: MapControl[] = [navigationControl, scaleControl, fullscreenControl];

  nextMap.addControl(navigationControl, "top-right");
  nextMap.addControl(scaleControl, "bottom-right");
  nextMap.addControl(fullscreenControl, "top-right");

  return controls;
}

export function initializeAppShellMap(container: HTMLDivElement): AppShellMapSetup {
  const disposePmtilesProtocol = registerPmtilesProtocol();
  const map = createMap(createMapLibreAdapter(), container, {
    style: defaultBasemapStyleUrl(),
    center: [-98.5795, 39.8283],
    zoom: 3.2,
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
    controls: mountMapControls(map),
    basemapLayerController: mountBasemapLayerVisibility(map),
    disposePmtilesProtocol,
  };
}

export function suppressMapLibreGlyphWarnings(): () => void {
  return (): void => {
    // Map initialization no longer patches console.warn globally.
  };
}
