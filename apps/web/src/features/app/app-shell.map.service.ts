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
import { MAPLIBRE_GLYPH_WARNING_PREFIX } from "@/features/app/app-shell.constants";
import {
  defaultBasemapStyleUrl,
  mountBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";

const MAPLIBRE_GLOBE_EASING_WARNING =
  "Easing around a point is not supported under globe projection.";
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
    zoom: 0.9,
    projection: { type: "globe" },
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
  const originalWarn = console.warn;

  console.warn = (...args: unknown[]): void => {
    const firstArg = args[0];
    if (typeof firstArg === "string" && firstArg.includes(MAPLIBRE_GLYPH_WARNING_PREFIX)) {
      return;
    }
    if (typeof firstArg === "string" && firstArg.includes(MAPLIBRE_GLOBE_EASING_WARNING)) {
      return;
    }

    if (firstArg instanceof Error && firstArg.message.includes(MAPLIBRE_GLYPH_WARNING_PREFIX)) {
      return;
    }
    if (firstArg instanceof Error && firstArg.message.includes(MAPLIBRE_GLOBE_EASING_WARNING)) {
      return;
    }

    originalWarn(...args);
  };

  return (): void => {
    console.warn = originalWarn;
  };
}
