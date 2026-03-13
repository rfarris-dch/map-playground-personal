import type { LngLat } from "@map-migration/map-engine";

export type SketchMeasureMode = "off" | "distance" | "area";
export type SketchMeasureAreaShape = "freeform" | "rectangle" | "circle";

export interface SketchAreaGeometry {
  readonly areaShape: SketchMeasureAreaShape;
  readonly areaSqKm: number | null;
  readonly distanceKm: number | null;
  readonly ring: readonly LngLat[];
}

export interface SketchMeasureState {
  readonly areaShape: SketchMeasureAreaShape;
  readonly areaSqKm: number | null;
  readonly canFinishArea: boolean;
  readonly completedAreaGeometry: SketchAreaGeometry | null;
  readonly distanceKm: number | null;
  readonly draftAreaGeometry: SketchAreaGeometry | null;
  readonly isAreaComplete: boolean;
  readonly mode: SketchMeasureMode;
  readonly vertexCount: number;
}

export interface SketchMeasureLayerOptions {
  readonly onStateChange?: (state: SketchMeasureState) => void;
}

export interface SketchMeasureLayerController {
  clear(): void;
  destroy(): void;
  finishArea(): void;
  setAreaShape(shape: SketchMeasureAreaShape): void;
  setMode(mode: SketchMeasureMode): void;
}

export interface SketchMeasureRuntimeState {
  areaComplete: boolean;
  areaShape: SketchMeasureAreaShape;
  cursorVertex: LngLat | null;
  mode: SketchMeasureMode;
  project: ((lngLat: LngLat) => [number, number]) | null;
  ready: boolean;
  unproject: ((point: [number, number]) => LngLat) | null;
  vertices: LngLat[];
}
