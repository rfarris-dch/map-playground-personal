import type { LayerCatalog, LayerId } from "@map-migration/map-layer-catalog";

export type LayerStatus =
  | { readonly state: "idle" }
  | { readonly state: "loading" }
  | { readonly state: "ready" }
  | { readonly state: "error"; readonly reason: string };

export function initialLayerStatus(): LayerStatus {
  return { state: "idle" };
}

export interface LayerVisibilityController {
  destroy(): void;
  setVisible(visible: boolean): void;
}

export interface LayerRuntimeSnapshot {
  readonly effectiveVisibility: Readonly<Partial<Record<LayerId, boolean>>>;
  readonly stressBlocked: Readonly<Partial<Record<LayerId, boolean>>>;
  readonly userVisibility: Readonly<Partial<Record<LayerId, boolean>>>;
}

export interface LayerRuntimeOptions {
  readonly catalog?: LayerCatalog;
  readonly onSnapshot?: (snapshot: LayerRuntimeSnapshot) => void;
}

export interface LayerRuntimeController {
  destroy(): void;
  getEffectiveVisible(layerId: LayerId): boolean;
  getUserVisible(layerId: LayerId): boolean;
  registerLayerController(layerId: LayerId, controller: LayerVisibilityController): void;
  setStressBlocked(layerId: LayerId, blocked: boolean): void;
  setUserVisible(layerId: LayerId, visible: boolean): void;
  unregisterLayerController(layerId: LayerId): void;
}
