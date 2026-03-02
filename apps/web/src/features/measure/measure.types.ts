import type { LngLat } from "@map-migration/map-engine";

export type MeasureMode = "off" | "distance" | "area";

export interface MeasureState {
  readonly areaSqKm: number | null;
  readonly distanceKm: number | null;
  readonly mode: MeasureMode;
  readonly vertexCount: number;
}

export interface MeasureLayerOptions {
  readonly onStateChange?: (state: MeasureState) => void;
}

export interface MeasureLayerController {
  clear(): void;
  destroy(): void;
  setMode(mode: MeasureMode): void;
}

export interface MeasureRuntimeState {
  cursorVertex: LngLat | null;
  mode: MeasureMode;
  ready: boolean;
  vertices: LngLat[];
}
