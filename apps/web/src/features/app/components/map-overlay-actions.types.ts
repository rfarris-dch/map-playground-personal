import type { MapViewExportFormat } from "@/features/app/map-export/map-export.types";

export interface MapOverlayActionsProps {
  readonly isMapExporting: boolean;
  readonly mapExportDisabledReason: string | null;
  readonly overlaysBlockedReason: string | null;
  readonly quickViewActive: boolean;
  readonly quickViewDisabledReason: string | null;
  readonly scannerActive: boolean;
  readonly selectionActive: boolean;
  readonly selectionDisabledReason: string | null;
  readonly sketchMeasureActive: boolean;
}

export interface MapOverlayActionsEmits {
  "export-map-view": [format: MapViewExportFormat];
  "toggle-quick-view": [];
  "toggle-scanner": [];
  "toggle-selection-panel": [];
  "toggle-sketch-measure-panel": [];
}
