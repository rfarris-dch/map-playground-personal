import type { IMap, LngLat } from "@map-migration/map-engine";
import type { MeasureSelectionImageSubject } from "@/features/app/measure-selection/measure-selection.types";

export interface ExportMeasureSelectionImageArgs {
  readonly filenamePrefix?: string;
  readonly format?: "image/png" | "image/jpeg";
  readonly map: IMap;
  readonly quality?: number;
  readonly selectionRing: readonly LngLat[];
  readonly subject: MeasureSelectionImageSubject;
}
