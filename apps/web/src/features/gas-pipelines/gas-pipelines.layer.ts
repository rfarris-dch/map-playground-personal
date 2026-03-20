import { createPmtilesSourceUrl } from "@map-migration/geo-tiles";
import type { IMap, MapExpression } from "@map-migration/map-engine";
import { initialLayerStatus, type LayerStatus } from "@/features/layers/layer-runtime.types";
import { mountManifestBackedLayerBootstrap } from "@/lib/manifest-backed-layer.service";
import type { GasPipelineLayerController } from "./gas-pipelines.types";

const DATASET = "gas-pipelines-v1";
const SOURCE_ID = "gas-pipelines";
const SOURCE_LAYER = "gas_pipelines";
const LINE_LAYER_ID = "gas-pipelines.lines";

interface GasPipelineLayerState {
  currentFilter: MapExpression | null;
  status: LayerStatus;
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
        "match",
        ["coalesce", ["get", "capacity_range"], ""],
        "0-25",
        "#F1B51F",
        "25-100",
        "#E21111",
        "100-350",
        "#D13CFF",
        "350-800",
        "#00B9C6",
        "800+",
        "#4908A7",
        "#6F6F79",
      ],
      "line-opacity": 0.7,
      "line-dasharray": [4, 2],
      "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 6, 1, 9, 1.6, 13, 2.5],
    },
  });
}

export function mountGasPipelineLayer(map: IMap): GasPipelineLayerController {
  const manifestPath = resolveManifestPath();
  const state: GasPipelineLayerState = {
    currentFilter: null,
    status: initialLayerStatus(),
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
      const reason = error instanceof Error ? error.message : "initialization failed";
      state.status = { state: "error", reason };
    },
    onInitialized() {
      state.status = { state: "ready" };
      applyVisibility();
      applyFilter();
    },
    onReady(readyBootstrap) {
      if (!state.visible) {
        return;
      }

      state.status = { state: "loading" };
      readyBootstrap.initializeSource().catch(() => {
        return;
      });
    },
    preserveNetworkErrorCause: true,
    startWhenStyleReady: true,
  });

  return {
    get status(): LayerStatus {
      return state.status;
    },
    setVisible(nextVisible: boolean): void {
      state.visible = nextVisible;
      if (state.visible && state.status.state !== "loading") {
        state.status = { state: "loading" };
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
