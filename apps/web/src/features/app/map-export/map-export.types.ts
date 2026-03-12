import type { IMap } from "@map-migration/map-engine";

export type MapImageExportFormat = "jpeg" | "png";
export type MapViewExportFormat = "jpeg" | "pdf" | "png";

export interface CaptureMapImageArgs {
  readonly format: MapImageExportFormat;
  readonly map: IMap;
  readonly quality?: number;
}

export interface ExportMapViewArgs {
  readonly filenamePrefix?: string;
  readonly format: MapViewExportFormat;
  readonly map: IMap;
  readonly quality?: number;
}
