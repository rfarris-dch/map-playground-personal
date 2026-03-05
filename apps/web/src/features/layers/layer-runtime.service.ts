import type { IMap } from "@map-migration/map-engine";
import {
  DEFAULT_LAYER_CATALOG,
  LAYER_IDS,
  type LayerCatalog,
  type LayerId,
  validateLayerCatalog,
} from "@map-migration/map-layer-catalog";
import type {
  LayerRuntimeController,
  LayerRuntimeOptions,
  LayerRuntimeSnapshot,
  LayerVisibilityController,
} from "@/features/layers/layer-runtime.types";
import type { LayerRuntimeState } from "./layer-runtime.service.types";

function cloneMapToRecord(map: ReadonlyMap<LayerId, boolean>): Partial<Record<LayerId, boolean>> {
  return Array.from(map.entries()).reduce<Partial<Record<LayerId, boolean>>>(
    (output, [key, value]) => {
      output[key] = value;
      return output;
    },
    {}
  );
}

function readCatalogVisibilityDefaults(catalog: LayerCatalog): Map<LayerId, boolean> {
  return LAYER_IDS.reduce((visibility, layerId) => {
    visibility.set(layerId, catalog[layerId].defaultVisible);
    return visibility;
  }, new Map<LayerId, boolean>());
}

function computeLayerVisibility(args: {
  readonly catalog: LayerCatalog;
  readonly effectiveVisibility: ReadonlyMap<LayerId, boolean>;
  readonly layerId: LayerId;
  readonly mapZoom: number;
  readonly stressBlocked: ReadonlyMap<LayerId, boolean>;
  readonly userVisibility: ReadonlyMap<LayerId, boolean>;
  readonly visiting: Set<LayerId>;
}): boolean {
  const definition = args.catalog[args.layerId];
  if (args.visiting.has(args.layerId)) {
    return false;
  }

  const userVisible = args.userVisibility.get(args.layerId) ?? definition.defaultVisible;
  if (!userVisible) {
    return false;
  }

  const stressBlocked = args.stressBlocked.get(args.layerId) ?? false;
  if (stressBlocked) {
    return false;
  }

  if (args.mapZoom < definition.zoomMin || args.mapZoom > definition.zoomMax) {
    return false;
  }

  args.visiting.add(args.layerId);
  for (const dependencyId of definition.dependencies) {
    const cachedDependencyVisibility = args.effectiveVisibility.get(dependencyId);
    if (typeof cachedDependencyVisibility !== "undefined") {
      if (!cachedDependencyVisibility) {
        args.visiting.delete(args.layerId);
        return false;
      }
      continue;
    }

    const nextDependencyVisible = computeLayerVisibility({
      ...args,
      layerId: dependencyId,
    });
    if (!nextDependencyVisible) {
      args.visiting.delete(args.layerId);
      return false;
    }
  }
  args.visiting.delete(args.layerId);

  return true;
}

function emitSnapshot(
  state: LayerRuntimeState,
  onSnapshot?: (snapshot: LayerRuntimeSnapshot) => void
): void {
  if (!onSnapshot) {
    return;
  }

  onSnapshot({
    userVisibility: cloneMapToRecord(state.userVisibility),
    effectiveVisibility: cloneMapToRecord(state.effectiveVisibility),
    stressBlocked: cloneMapToRecord(state.stressBlocked),
  });
}

export function createLayerRuntime(
  map: IMap,
  options: LayerRuntimeOptions = {}
): LayerRuntimeController {
  const catalog = options.catalog ?? DEFAULT_LAYER_CATALOG;
  const catalogErrors = validateLayerCatalog(catalog);
  if (catalogErrors.length > 0) {
    throw new Error(`[layer-runtime] invalid catalog: ${catalogErrors.join(" | ")}`);
  }

  const state: LayerRuntimeState = {
    controllers: new Map(),
    destroyed: false,
    effectiveVisibility: new Map(),
    stressBlocked: new Map(),
    userVisibility: readCatalogVisibilityDefaults(catalog),
  };

  const applyVisibility = (): void => {
    if (state.destroyed) {
      return;
    }

    const mapZoom = map.getZoom();
    state.effectiveVisibility.clear();

    for (const layerId of LAYER_IDS) {
      const effective = computeLayerVisibility({
        catalog,
        layerId,
        mapZoom,
        userVisibility: state.userVisibility,
        stressBlocked: state.stressBlocked,
        effectiveVisibility: state.effectiveVisibility,
        visiting: new Set<LayerId>(),
      });
      state.effectiveVisibility.set(layerId, effective);
    }

    for (const [layerId, controller] of state.controllers) {
      const nextVisible = state.effectiveVisibility.get(layerId) ?? false;
      controller.setVisible(nextVisible);
    }

    emitSnapshot(state, options.onSnapshot);
  };

  const onMoveEnd = (): void => {
    applyVisibility();
  };

  const onLoad = (): void => {
    applyVisibility();
  };

  map.on("moveend", onMoveEnd);
  map.on("load", onLoad);

  return {
    registerLayerController(layerId: LayerId, controller: LayerVisibilityController): void {
      if (state.destroyed) {
        return;
      }

      state.controllers.set(layerId, controller);
      applyVisibility();
    },

    unregisterLayerController(layerId: LayerId): void {
      if (state.destroyed) {
        return;
      }

      state.controllers.delete(layerId);
      applyVisibility();
    },

    setUserVisible(layerId: LayerId, visible: boolean): void {
      if (state.destroyed) {
        return;
      }

      state.userVisibility.set(layerId, visible);
      applyVisibility();
    },

    setStressBlocked(layerId: LayerId, blocked: boolean): void {
      if (state.destroyed) {
        return;
      }

      state.stressBlocked.set(layerId, blocked);
      applyVisibility();
    },

    getUserVisible(layerId: LayerId): boolean {
      const catalogEntry = catalog[layerId];
      const fallback = catalogEntry ? catalogEntry.defaultVisible : false;
      return state.userVisibility.get(layerId) ?? fallback;
    },

    getEffectiveVisible(layerId: LayerId): boolean {
      return state.effectiveVisibility.get(layerId) ?? false;
    },

    destroy(): void {
      if (state.destroyed) {
        return;
      }

      state.destroyed = true;
      map.off("moveend", onMoveEnd);
      map.off("load", onLoad);
      state.controllers.clear();
      state.effectiveVisibility.clear();
      state.stressBlocked.clear();
      state.userVisibility.clear();
    },
  };
}
