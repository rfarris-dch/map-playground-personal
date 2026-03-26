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
