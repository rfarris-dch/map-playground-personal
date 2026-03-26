import {
  assertTileManifestMatchesDataset,
  type TileDataset,
  type TilePublishManifest,
} from "@map-migration/geo-tiles";
import { loadTilePublishManifest } from "@map-migration/geo-tiles/effect";
import type { IMap } from "@map-migration/map-engine";

interface ManifestBackedLayerState {
  cachedManifest: TilePublishManifest | null;
  destroyed: boolean;
  ready: boolean;
  sourceInitializationPromise: Promise<void> | null;
  sourceInitialized: boolean;
}

interface ManifestBackedLayerBootstrap {
  destroy(): void;
  initializeSource(): Promise<void>;
  isReady(): boolean;
  isSourceInitialized(): boolean;
}

interface ManifestBackedLayerBootstrapOptions {
  readonly contextLabel: string;
  readonly dataset?: TileDataset;
  readonly ensureLayers: () => void;
  readonly ensureSource: (manifest: TilePublishManifest) => void;
  readonly manifestPath: string;
  readonly map: IMap;
  readonly onInitializationError?: (error: unknown) => void;
  readonly onInitialized?: (manifest: TilePublishManifest) => void;
  readonly onInitializeSettled?: () => void;
  readonly onInitializeStart?: (promise: Promise<void>) => void;
  readonly onReady?: (bootstrap: ManifestBackedLayerBootstrap) => void;
  readonly preserveNetworkErrorCause?: boolean;
  readonly startWhenStyleReady?: boolean;
}

function initialState(): ManifestBackedLayerState {
  return {
    cachedManifest: null,
    destroyed: false,
    ready: false,
    sourceInitialized: false,
    sourceInitializationPromise: null,
  };
}

export function mountManifestBackedLayerBootstrap(
  options: ManifestBackedLayerBootstrapOptions
): ManifestBackedLayerBootstrap {
  const state = initialState();

  const bootstrap: ManifestBackedLayerBootstrap = {
    destroy(): void {
      state.destroyed = true;
      options.map.off("load", onLoad);
    },
    initializeSource(): Promise<void> {
      if (state.destroyed || state.sourceInitialized) {
        return Promise.resolve();
      }

      if (state.sourceInitializationPromise !== null) {
        return state.sourceInitializationPromise;
      }

      const sourceInitializationPromise = (async (): Promise<void> => {
        const manifest = await loadTilePublishManifest({
          contextLabel: options.contextLabel,
          manifestPath: options.manifestPath,
          ...(typeof options.preserveNetworkErrorCause === "boolean"
            ? { preserveNetworkErrorCause: options.preserveNetworkErrorCause }
            : {}),
        });

        if (state.destroyed) {
          return;
        }

        if (typeof options.dataset !== "undefined") {
          assertTileManifestMatchesDataset(
            manifest,
            options.dataset,
            `${options.contextLabel} layer manifest`
          );
        }

        state.cachedManifest = manifest;
        options.ensureSource(manifest);
        options.ensureLayers();
        state.sourceInitialized = true;
        options.onInitialized?.(manifest);
      })()
        .catch((error: unknown) => {
          options.onInitializationError?.(error);
          throw error;
        })
        .finally(() => {
          state.sourceInitializationPromise = null;
          options.onInitializeSettled?.();
        });

      state.sourceInitializationPromise = sourceInitializationPromise;
      options.onInitializeStart?.(sourceInitializationPromise);
      return sourceInitializationPromise;
    },
    isReady(): boolean {
      return state.ready;
    },
    isSourceInitialized(): boolean {
      return state.sourceInitialized;
    },
  };

  function onLoad(): void {
    const wasReady = state.ready;
    const wasSourceInitialized = state.sourceInitialized;
    state.ready = true;

    if (wasReady && wasSourceInitialized) {
      state.sourceInitialized = false;
      state.sourceInitializationPromise = null;
    }

    if (wasReady && wasSourceInitialized && state.cachedManifest !== null) {
      options.ensureSource(state.cachedManifest);
      options.ensureLayers();
      state.sourceInitialized = true;
      options.onInitialized?.(state.cachedManifest);
      return;
    }

    options.onReady?.(bootstrap);
  }

  options.map.on("load", onLoad);
  if (options.startWhenStyleReady && (options.map.getStyle()?.layers?.length ?? 0) > 0) {
    onLoad();
  }

  return bootstrap;
}
