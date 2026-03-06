import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { MeasureAreaShape, MeasureMode, MeasureState } from "@/features/measure/measure.types";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";

export interface MapMeasureToolsProps {
  readonly isLoading: boolean;
  readonly isPanelOpen: boolean;
  readonly measureState: MeasureState;
  readonly selectionError: string | null;
  readonly selectionSummary: MeasureSelectionSummary | null;
}

export interface MapMeasureToolsEmits {
  clear: [];
  export: [];
  finish: [];
  "select-facility": [facility: SelectedFacilityRef];
  "set-area-shape": [shape: MeasureAreaShape];
  "set-mode": [mode: MeasureMode];
  "toggle-panel": [];
}
