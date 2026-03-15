import type { IMap } from "@map-migration/map-engine";
import type { LayerStatus, LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type HydroBasinsStressMode = "degraded" | "normal";

export interface HydroBasinsVisibilityController extends LayerVisibilityController {
  setStressMode(mode: HydroBasinsStressMode): void;
  readonly status: LayerStatus;
}

export interface MountHydroBasinsLayerOptions {
  readonly manifestPath?: string;
  readonly map: IMap;
}
