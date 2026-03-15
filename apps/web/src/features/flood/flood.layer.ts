import { createPmtilesSourceUrl, type TilePublishManifest } from "@map-migration/geo-tiles";
import type { IMap } from "@map-migration/map-engine";
import { getCatalogStyleLayerIds, getFloodStyleLayerIds } from "@map-migration/map-style";
import { initialLayerStatus, type LayerStatus } from "@/features/layers/layer-runtime.types";
import { resolveEnvironmentalFloodManifestPath } from "@/features/tiles/tile-manifest-config.service";
import { mountManifestBackedLayerBootstrap } from "@/lib/manifest-backed-layer.service";
import type {
  FloodLayerMountResult,
  FloodLayerVisibilityController,
  MountFloodLayersOptions,
} from "./flood-layer.types";
import {
  flood100FillFilter,
  flood100FillPaint,
  flood500FillFilter,
  flood500FillPaint,
} from "./flood-style.service";

const FLOOD_DATASET = "environmental-flood";
const FLOOD_SOURCE_ID = "environmental-flood";
const DEFAULT_SOURCE_LAYER = "flood-hazard";
const UPPER_BOUND_LAYER_ANCHORS: readonly string[] = [
  ...getCatalogStyleLayerIds("property.parcels"),
  ...getCatalogStyleLayerIds("facilities.colocation"),
  ...getCatalogStyleLayerIds("facilities.hyperscale"),
];

interface FloodLayerState {
  flood100Visible: boolean;
  flood500Visible: boolean;
  status: LayerStatus;
}

function initialState(): FloodLayerState {
  return {
    flood100Visible: false,
    flood500Visible: false,
    status: initialLayerStatus(),
  };
}

function resolveBeforeLayerId(map: IMap): string | undefined {
  for (const layerId of UPPER_BOUND_LAYER_ANCHORS) {
    if (map.hasLayer(layerId)) {
      return layerId;
    }
  }

  return undefined;
}

function ensureFloodSource(
  map: IMap,
  manifest: TilePublishManifest,
  manifestPath: string,
  sourceId: string = FLOOD_SOURCE_ID
): void {
  if (map.hasSource(sourceId)) {
    return;
  }

  map.addSource(sourceId, {
    type: "vector",
    url: createPmtilesSourceUrl(manifest, manifestPath),
  });
}

function ensureFloodLayers(
  map: IMap,
  sourceLayer: string,
  sourceId: string = FLOOD_SOURCE_ID
): void {
  const styleLayerIds = getFloodStyleLayerIds("environmental.flood-100");
  const beforeLayerId = resolveBeforeLayerId(map);

  if (!map.hasLayer(styleLayerIds.fill500LayerId)) {
    map.addLayer(
      {
        id: styleLayerIds.fill500LayerId,
        type: "fill",
        source: sourceId,
        "source-layer": sourceLayer,
        minzoom: 0,
        maxzoom: 24,
        filter: flood500FillFilter(),
        paint: flood500FillPaint(),
      },
      beforeLayerId
    );
  }

  if (!map.hasLayer(styleLayerIds.fill100LayerId)) {
    map.addLayer(
      {
        id: styleLayerIds.fill100LayerId,
        type: "fill",
        source: sourceId,
        "source-layer": sourceLayer,
        minzoom: 0,
        maxzoom: 24,
        filter: flood100FillFilter(),
        paint: flood100FillPaint(),
      },
      beforeLayerId
    );
  }
}

function setLayerVisibility(map: IMap, layerId: string, visible: boolean): void {
  if (!map.hasLayer(layerId)) {
    return;
  }

  map.setLayerVisibility(layerId, visible);
}

export function mountFloodLayers(options: MountFloodLayersOptions): FloodLayerMountResult {
  const state = initialState();
  const manifestPath = resolveEnvironmentalFloodManifestPath(options.manifestPath);
  const sourceLayer = options.sourceLayer ?? DEFAULT_SOURCE_LAYER;
  const styleLayerIds = getFloodStyleLayerIds("environmental.flood-100");

  function applyVisibility(): void {
    if (!(bootstrap.isReady() && bootstrap.isSourceInitialized())) {
      return;
    }

    setLayerVisibility(options.map, styleLayerIds.fill500LayerId, state.flood500Visible);
    setLayerVisibility(options.map, styleLayerIds.fill100LayerId, state.flood100Visible);
  }

  const bootstrap = mountManifestBackedLayerBootstrap({
    contextLabel: "flood",
    dataset: FLOOD_DATASET,
    ensureLayers() {
      ensureFloodLayers(options.map, sourceLayer);
    },
    ensureSource(manifest) {
      ensureFloodSource(options.map, manifest, manifestPath);
    },
    manifestPath,
    map: options.map,

    onInitializationError(error: unknown) {
      const reason = error instanceof Error ? error.message : "initialization failed";
      state.status = { state: "error", reason };
    },
    onInitialized() {
      state.status = { state: "ready" };
      applyVisibility();
    },
    onReady(readyBootstrap) {
      if (state.flood100Visible || state.flood500Visible) {
        state.status = { state: "loading" };
        readyBootstrap.initializeSource().catch(() => {
          return;
        });
        return;
      }

      if (readyBootstrap.isSourceInitialized()) {
        applyVisibility();
      }
    },
    startWhenStyleReady: true,
  });

  const flood100Controller: FloodLayerVisibilityController = {
    layerId: "flood-100",
    setVisible(visible: boolean): void {
      state.flood100Visible = visible;
      if (visible && bootstrap.isReady() && state.status.state !== "loading") {
        state.status = { state: "loading" };
        bootstrap.initializeSource().catch(() => {
          return;
        });
      }

      applyVisibility();
    },
    destroy(): void {
      return;
    },
  };

  const flood500Controller: FloodLayerVisibilityController = {
    layerId: "flood-500",
    setVisible(visible: boolean): void {
      state.flood500Visible = visible;
      if (visible && bootstrap.isReady() && state.status.state !== "loading") {
        state.status = { state: "loading" };
        bootstrap.initializeSource().catch(() => {
          return;
        });
      }

      applyVisibility();
    },
    destroy(): void {
      return;
    },
  };

  return {
    get status(): LayerStatus {
      return state.status;
    },
    controllers: {
      flood100: flood100Controller,
      flood500: flood500Controller,
    },
    destroy(): void {
      bootstrap.destroy();

      for (const layerId of [styleLayerIds.fill100LayerId, styleLayerIds.fill500LayerId]) {
        if (options.map.hasLayer(layerId)) {
          options.map.removeLayer(layerId);
        }
      }

      if (options.map.hasSource(FLOOD_SOURCE_ID)) {
        options.map.removeSource(FLOOD_SOURCE_ID);
      }
    },
  };
}
