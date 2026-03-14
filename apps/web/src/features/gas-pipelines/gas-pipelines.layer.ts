import { runEffectPromise } from "@map-migration/core-runtime/effect";
import { createPmtilesSourceUrl } from "@map-migration/geo-tiles";
import { loadTilePublishManifestEffect } from "@map-migration/geo-tiles/effect";
import type { IMap, MapExpression } from "@map-migration/map-engine";
import { Effect, Either } from "effect";
import type { GasPipelineLayerController } from "./gas-pipelines.types";

const SOURCE_ID = "gas-pipelines";
const SOURCE_LAYER = "gas_pipelines";
const LINE_LAYER_ID = "gas-pipelines.lines";

function resolveManifestPath(): string {
  const configured = import.meta.env.VITE_GAS_PIPELINES_MANIFEST_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured;
  }
  return "/tiles/gas-pipelines-v1/latest.json";
}

export function mountGasPipelineLayer(map: IMap): GasPipelineLayerController {
  let visible = false;
  let currentFilter: MapExpression | null = null;
  let sourceInitialized = false;
  let destroyed = false;

  function applyVisibility(): void {
    if (!sourceInitialized) {
      return;
    }
    if (map.hasLayer(LINE_LAYER_ID)) {
      map.setLayerVisibility(LINE_LAYER_ID, visible);
    }
  }

  function applyFilter(): void {
    if (!sourceInitialized) {
      return;
    }
    if (map.hasLayer(LINE_LAYER_ID)) {
      map.setLayerFilter(LINE_LAYER_ID, currentFilter);
    }
  }

  function ensureSource(manifestUrl: string): void {
    if (map.hasSource(SOURCE_ID)) {
      return;
    }
    map.addSource(SOURCE_ID, {
      type: "vector",
      url: manifestUrl,
    });
  }

  function ensureLayers(): void {
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

  async function initializeSource(): Promise<void> {
    if (destroyed || sourceInitialized) {
      return;
    }

    const result = await runEffectPromise(
      Effect.either(
        loadTilePublishManifestEffect({
          contextLabel: "gas-pipelines",
          manifestPath: resolveManifestPath(),
          preserveNetworkErrorCause: true,
        })
      )
    );

    if (Either.isLeft(result) || destroyed) {
      return;
    }

    const manifest = result.right.data;
    const pmtilesUrl = createPmtilesSourceUrl(manifest, resolveManifestPath());
    ensureSource(pmtilesUrl);
    ensureLayers();
    sourceInitialized = true;
    applyVisibility();
    if (currentFilter !== null) {
      applyFilter();
    }
  }

  const onLoad = (): void => {
    if (!visible) {
      return;
    }
    initializeSource().catch((err) => {
      console.error("[gas-pipelines] init failed", err);
    });
  };

  map.on("load", onLoad);

  function initializeSourceWithLogging(context: string): void {
    initializeSource().catch((error) => {
      console.error(`[gas-pipelines] ${context} failed`, error);
    });
  }

  return {
    setVisible(nextVisible: boolean): void {
      visible = nextVisible;
      if (visible && !sourceInitialized) {
        initializeSourceWithLogging("visibility sync");
      }
      applyVisibility();
    },
    setFilter(filter: MapExpression | null): void {
      currentFilter = filter;
      applyFilter();
    },
    destroy(): void {
      destroyed = true;
      map.off("load", onLoad);
      if (map.hasLayer(LINE_LAYER_ID)) {
        map.removeLayer(LINE_LAYER_ID);
      }
      if (map.hasSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    },
  };
}
