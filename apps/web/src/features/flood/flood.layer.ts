import { runEffectPromise } from "@map-migration/core-runtime/effect";
import {
  assertTileManifestMatchesDataset,
  createPmtilesSourceUrl,
  type TilePublishManifest,
} from "@map-migration/geo-tiles";
import { loadTilePublishManifestEffect } from "@map-migration/geo-tiles/effect";
import type { IMap } from "@map-migration/map-engine";
import { getCatalogStyleLayerIds, getFloodStyleLayerIds } from "@map-migration/map-style";
import { Effect, Either } from "effect";
import { resolveEnvironmentalFloodManifestPath } from "@/features/tiles/tile-manifest-config.service";
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
  destroyed: boolean;
  flood100Visible: boolean;
  flood500Visible: boolean;
  ready: boolean;
  sourceInitializationPromise: Promise<void> | null;
  sourceInitialized: boolean;
}

function initialState(): FloodLayerState {
  return {
    destroyed: false,
    flood100Visible: false,
    flood500Visible: false,
    ready: false,
    sourceInitialized: false,
    sourceInitializationPromise: null,
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
    if (!(state.ready && state.sourceInitialized)) {
      return;
    }

    setLayerVisibility(options.map, styleLayerIds.fill500LayerId, state.flood500Visible);
    setLayerVisibility(options.map, styleLayerIds.fill100LayerId, state.flood100Visible);
    setLayerVisibility(options.map, styleLayerIds.outline500LayerId, state.flood500Visible);
    setLayerVisibility(options.map, styleLayerIds.outline100LayerId, state.flood100Visible);
  }

  function completeSourceInitialization(manifest: TilePublishManifest): void {
    assertTileManifestMatchesDataset(manifest, FLOOD_DATASET, "flood layer manifest");
    ensureFloodSource(options.map, manifest, manifestPath);
    ensureFloodLayers(options.map, sourceLayer);
    state.sourceInitialized = true;
    applyVisibility();
  }

  function initializeSource(): Promise<void> {
    if (state.destroyed || state.sourceInitialized) {
      return Promise.resolve();
    }

    if (state.sourceInitializationPromise !== null) {
      return state.sourceInitializationPromise;
    }

    const nextPromise = (async (): Promise<void> => {
      const result = await runEffectPromise(
        Effect.either(
          loadTilePublishManifestEffect({
            contextLabel: "flood",
            manifestPath,
          })
        )
      );
      if (state.destroyed) {
        return;
      }

      if (Either.isLeft(result)) {
        throw result.left;
      }

      completeSourceInitialization(result.right.data);
    })().finally(() => {
      state.sourceInitializationPromise = null;
    });

    state.sourceInitializationPromise = nextPromise;
    return nextPromise;
  }

  const onLoad = (): void => {
    state.ready = true;

    if (state.flood100Visible || state.flood500Visible) {
      initializeSource().catch((error: unknown) => {
        console.error("[flood] source initialization failed", error);
      });
      return;
    }

    if (state.sourceInitialized) {
      applyVisibility();
    }
  };

  options.map.on("load", onLoad);

  const flood100Controller: FloodLayerVisibilityController = {
    layerId: "flood-100",
    setVisible(visible: boolean): void {
      state.flood100Visible = visible;
      if (visible && state.ready) {
        initializeSource().catch((error: unknown) => {
          console.error("[flood] source initialization failed", error);
        });
      }

      applyVisibility();
    },
    destroy(): void {
      // No-op: lifecycle teardown is handled by the parent flood mount.
    },
  };

  const flood500Controller: FloodLayerVisibilityController = {
    layerId: "flood-500",
    setVisible(visible: boolean): void {
      state.flood500Visible = visible;
      if (visible && state.ready) {
        initializeSource().catch((error: unknown) => {
          console.error("[flood] source initialization failed", error);
        });
      }

      applyVisibility();
    },
    destroy(): void {
      // No-op: lifecycle teardown is handled by the parent flood mount.
    },
  };

  return {
    controllers: {
      flood100: flood100Controller,
      flood500: flood500Controller,
    },
    destroy(): void {
      state.destroyed = true;
      options.map.off("load", onLoad);

      for (const layerId of [
        styleLayerIds.outline100LayerId,
        styleLayerIds.outline500LayerId,
        styleLayerIds.fill100LayerId,
        styleLayerIds.fill500LayerId,
      ]) {
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
