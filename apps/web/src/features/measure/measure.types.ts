import type { LngLat } from "@map-migration/map-engine";

export type MeasureMode = "off" | "distance" | "area";
export type MeasureAreaShape = "freeform" | "rectangle" | "circle";

export interface MeasureState {
  readonly areaShape: MeasureAreaShape;
  readonly areaSqKm: number | null;
  readonly canFinishSelection: boolean;
  readonly distanceKm: number | null;
  readonly isSelectionComplete: boolean;
  readonly mode: MeasureMode;
  readonly selectionRing: readonly LngLat[] | null;
  readonly vertexCount: number;
}

export interface MeasureLayerOptions {
  readonly onStateChange?: (state: MeasureState) => void;
}

export interface MeasureLayerController {
  clear(): void;
  destroy(): void;
  finishSelection(): void;
  setAreaShape(shape: MeasureAreaShape): void;
  setMode(mode: MeasureMode): void;
}

export interface MeasureRuntimeState {
  areaComplete: boolean;
  areaShape: MeasureAreaShape;
  cursorVertex: LngLat | null;
  mode: MeasureMode;
  project: ((lngLat: LngLat) => [number, number]) | null;
  ready: boolean;
  unproject: ((point: [number, number]) => LngLat) | null;
  vertices: LngLat[];
}
