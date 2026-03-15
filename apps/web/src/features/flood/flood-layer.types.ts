import type { IMap } from "@map-migration/map-engine";
import type { LayerStatus, LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type FloodLayerId = "flood-100" | "flood-500";

export interface FloodLayerVisibilityController extends LayerVisibilityController {
  readonly layerId: FloodLayerId;
}

export interface FloodLayerMountResult {
  readonly controllers: Readonly<{
    readonly flood100: FloodLayerVisibilityController;
    readonly flood500: FloodLayerVisibilityController;
  }>;
  destroy(): void;
  readonly status: LayerStatus;
}

export interface MountFloodLayersOptions {
  readonly manifestPath?: string;
  readonly map: IMap;
  readonly sourceLayer?: string;
}
