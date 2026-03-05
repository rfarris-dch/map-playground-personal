import {
  createMap,
  createMapLibreAdapter,
  type IMap,
  registerPmtilesProtocol,
} from "@map-migration/map-engine";
import maplibregl, { type IControl } from "maplibre-gl";
import {
  defaultBasemapStyleUrl,
  mountBasemap3DBuildings,
} from "@/features/basemap/basemap.service";
import { MAPLIBRE_GLYPH_WARNING_PREFIX } from "./app-shell.constants";

export interface AppShellMapSetup {
  readonly controls: readonly IControl[];
  readonly disposeBasemapEnhancements: () => void;
  readonly disposePmtilesProtocol: () => void;
  readonly map: IMap;
}

function mountMapControls(nextMap: IMap): readonly IControl[] {
  const navigationControl = new maplibregl.NavigationControl({
    showCompass: true,
    showZoom: true,
  });
  const scaleControl = new maplibregl.ScaleControl({ maxWidth: 140, unit: "imperial" });
  const fullscreenControl = new maplibregl.FullscreenControl();

  const controls: IControl[] = [navigationControl, scaleControl, fullscreenControl];

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
    zoom: 4,
  });

  return {
    map,
    controls: mountMapControls(map),
    disposeBasemapEnhancements: mountBasemap3DBuildings(map),
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

    if (firstArg instanceof Error && firstArg.message.includes(MAPLIBRE_GLYPH_WARNING_PREFIX)) {
      return;
    }

    originalWarn(...args);
  };

  return (): void => {
    console.warn = originalWarn;
  };
}
