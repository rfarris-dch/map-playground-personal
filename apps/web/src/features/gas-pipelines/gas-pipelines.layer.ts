import { createPmtilesSourceUrl } from "@map-migration/geo-tiles";
import type { IMap, MapExpression } from "@map-migration/map-engine";
import { mountManifestBackedLayerBootstrap } from "@/lib/manifest-backed-layer.service";
import type { GasPipelineLayerController } from "./gas-pipelines.types";

const DATASET = "gas-pipelines-v1";
const SOURCE_ID = "gas-pipelines";
const SOURCE_LAYER = "gas_pipelines";
const LINE_LAYER_ID = "gas-pipelines.lines";

interface GasPipelineLayerState {
  currentFilter: MapExpression | null;
  visible: boolean;
}

function resolveManifestPath(): string {
  const configured = import.meta.env.VITE_GAS_PIPELINES_MANIFEST_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured;
  }

  return "/tiles/gas-pipelines-v1/latest.json";
}

function ensureSource(map: IMap, manifestUrl: string): void {
  if (map.hasSource(SOURCE_ID)) {
    return;
  }

  map.addSource(SOURCE_ID, {
    type: "vector",
    url: manifestUrl,
  });
}

function ensureLayers(map: IMap): void {
  if (map.hasLayer(LINE_LAYER_ID)) {
    return;
  }

  map.addLayer({
    id: LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": [
        "case",
        ["==", ["get", "typepipe"], "Interstate"],
        "#dc2626",
        ["==", ["get", "typepipe"], "Intrastate"],
        "#f97316",
        "#a3a3a3",
      ],
      "line-opacity": 0.7,
      "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 6, 0.8, 9, 1.4, 13, 2.5],
    },
  });
}

export function mountGasPipelineLayer(map: IMap): GasPipelineLayerController {
  const manifestPath = resolveManifestPath();
  const state: GasPipelineLayerState = {
    currentFilter: null,
    visible: false,
  };

  function applyVisibility(): void {
    if (!(bootstrap.isSourceInitialized() && map.hasLayer(LINE_LAYER_ID))) {
      return;
    }

    map.setLayerVisibility(LINE_LAYER_ID, state.visible);
  }

  function applyFilter(): void {
    if (!(bootstrap.isSourceInitialized() && map.hasLayer(LINE_LAYER_ID))) {
      return;
    }

    map.setLayerFilter(LINE_LAYER_ID, state.currentFilter);
  }

  const bootstrap = mountManifestBackedLayerBootstrap({
    contextLabel: "gas-pipelines",
    dataset: DATASET,
    ensureLayers() {
      ensureLayers(map);
    },
    ensureSource(manifest) {
      ensureSource(map, createPmtilesSourceUrl(manifest, manifestPath));
    },
    manifestPath,
    map,
    onInitializationError(error: unknown) {
      console.error("[gas-pipelines] init failed", error);
    },
    onInitialized() {
      applyVisibility();
      applyFilter();
    },
    onReady(readyBootstrap) {
      if (!state.visible) {
        return;
      }

      readyBootstrap.initializeSource().catch(() => {
        return;
      });
    },
    preserveNetworkErrorCause: true,
    startWhenStyleReady: true,
  });

  return {
    setVisible(nextVisible: boolean): void {
      state.visible = nextVisible;
      if (state.visible) {
        bootstrap.initializeSource().catch(() => {
          return;
        });
      }

      applyVisibility();
    },
    setFilter(filter: MapExpression | null): void {
      state.currentFilter = filter;
      applyFilter();
    },
    destroy(): void {
      bootstrap.destroy();

      if (map.hasLayer(LINE_LAYER_ID)) {
        map.removeLayer(LINE_LAYER_ID);
      }
      if (map.hasSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    },
  };
}
