import type { IMap } from "@map-migration/map-engine";
import {
  DEFAULT_LAYER_CATALOG,
  LAYER_IDS,
  type LayerCatalog,
  type LayerId,
  validateLayerCatalog,
} from "@map-migration/map-layer-catalog";
import {
  createAppPerformanceTimer,
  recordAppPerformanceCounter,
} from "@/features/app/diagnostics/app-performance.service";
import { shouldRefreshViewportData } from "@/features/app/interaction/map-interaction-policy.service";
import type {
  LayerRuntimeController,
  LayerRuntimeOptions,
  LayerRuntimeSnapshot,
  LayerVisibilityController,
} from "@/features/layers/layer-runtime.types";
import type { LayerRuntimeState } from "./layer-runtime.service.types";

function serializeLayerVisibilityMap(map: ReadonlyMap<LayerId, boolean>): string {
  return LAYER_IDS.map((layerId) => ((map.get(layerId) ?? false) ? "1" : "0")).join("");
}

function buildSnapshotSignature(state: LayerRuntimeState): string {
  return [
    serializeLayerVisibilityMap(state.userVisibility),
    serializeLayerVisibilityMap(state.effectiveVisibility),
    serializeLayerVisibilityMap(state.stressBlocked),
  ].join("|");
}

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
  const controllerVisibility = new Map<LayerId, boolean>();
  let lastMapZoom: number | null = null;
  let lastInteractionViewportKey: string | null = null;
  let lastSnapshotSignature: string | null = null;
  let visibilityDirty = true;
  let unsubscribeInteractionCoordinator: (() => void) | null = null;

  const applyVisibility = (force = false): void => {
    if (state.destroyed) {
      return;
    }

    const mapZoom = map.getZoom();
    const zoomChanged = lastMapZoom === null || Math.abs(mapZoom - lastMapZoom) > 1e-6;

    if (!(force || visibilityDirty || zoomChanged)) {
      return;
    }

    lastMapZoom = mapZoom;

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
      if (!force && controllerVisibility.get(layerId) === nextVisible) {
        continue;
      }

      controller.setVisible(nextVisible);
      controllerVisibility.set(layerId, nextVisible);
    }

    const nextSnapshotSignature = buildSnapshotSignature(state);
    if (nextSnapshotSignature !== lastSnapshotSignature) {
      lastSnapshotSignature = nextSnapshotSignature;
      emitSnapshot(state, options.onSnapshot);
    }

    visibilityDirty = false;
  };

  const onMoveEnd = (): void => {
    recordAppPerformanceCounter("map.moveend", { feature: "layer-runtime" });
    const stopMoveEndTimer = createAppPerformanceTimer("layer-runtime.moveend-handler.time");
    applyVisibility();
    stopMoveEndTimer();
  };

  const onLoad = (): void => {
    lastInteractionViewportKey = null;
    applyVisibility(true);
    // Style reload: other controllers may recreate their map layers in their
    // own "load" handlers that fire AFTER this one (registration order).
    // Reset caches so the next moveend re-pushes visibility once those layers exist.
    controllerVisibility.clear();
    visibilityDirty = true;
  };

  if (
    options.interactionCoordinator === null ||
    typeof options.interactionCoordinator === "undefined"
  ) {
    map.on("moveend", onMoveEnd);
    map.on("load", onLoad);
  } else {
    unsubscribeInteractionCoordinator = options.interactionCoordinator.subscribe((snapshot) => {
      if (snapshot.eventType === "load") {
        onLoad();
        return;
      }

      if (!shouldRefreshViewportData(snapshot)) {
        return;
      }

      if (lastInteractionViewportKey === snapshot.canonicalViewportKey) {
        return;
      }

      lastInteractionViewportKey = snapshot.canonicalViewportKey;
      onMoveEnd();
    });
  }

  return {
    registerLayerController(layerId: LayerId, controller: LayerVisibilityController): void {
      if (state.destroyed) {
        return;
      }

      state.controllers.set(layerId, controller);
      controllerVisibility.delete(layerId);
      visibilityDirty = true;
      applyVisibility(true);
    },

    unregisterLayerController(layerId: LayerId): void {
      if (state.destroyed) {
        return;
      }

      state.controllers.delete(layerId);
      controllerVisibility.delete(layerId);
    },

    setUserVisible(layerId: LayerId, visible: boolean): void {
      if (state.destroyed) {
        return;
      }

      if ((state.userVisibility.get(layerId) ?? false) === visible) {
        return;
      }

      state.userVisibility.set(layerId, visible);
      visibilityDirty = true;
      applyVisibility();
    },

    setStressBlocked(layerId: LayerId, blocked: boolean): void {
      if (state.destroyed) {
        return;
      }

      if ((state.stressBlocked.get(layerId) ?? false) === blocked) {
        return;
      }

      state.stressBlocked.set(layerId, blocked);
      visibilityDirty = true;
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
      unsubscribeInteractionCoordinator?.();
      unsubscribeInteractionCoordinator = null;
      if (
        options.interactionCoordinator === null ||
        typeof options.interactionCoordinator === "undefined"
      ) {
        map.off("moveend", onMoveEnd);
        map.off("load", onLoad);
      }
      state.controllers.clear();
      state.effectiveVisibility.clear();
      state.stressBlocked.clear();
      state.userVisibility.clear();
      controllerVisibility.clear();
      lastMapZoom = null;
      lastInteractionViewportKey = null;
      lastSnapshotSignature = null;
      visibilityDirty = false;
    },
  };
}
