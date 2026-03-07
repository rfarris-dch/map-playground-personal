import type {
  MeasureSelectionImageSubject,
  MeasureSelectionOutputMode,
} from "@/features/app/measure-selection/measure-selection.types";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { MeasureAreaShape, MeasureMode, MeasureState } from "@/features/measure/measure.types";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";

export interface MapMeasureToolsProps {
  readonly isLoading: boolean;
  readonly isPanelOpen: boolean;
  readonly measureSelectionImageSubject: MeasureSelectionImageSubject;
  readonly measureSelectionOutputMode: MeasureSelectionOutputMode;
  readonly measureState: MeasureState;
  readonly selectionError: string | null;
  readonly selectionSummary: MeasureSelectionSummary | null;
}

export interface MapMeasureToolsEmits {
  clear: [];
  export: [];
  finish: [];
  "open-dashboard": [];
  "select-facility": [facility: SelectedFacilityRef];
  "set-area-shape": [shape: MeasureAreaShape];
  "set-image-subject": [subject: MeasureSelectionImageSubject];
  "set-mode": [mode: MeasureMode];
  "set-output-mode": [mode: MeasureSelectionOutputMode];
  "toggle-panel": [];
}
