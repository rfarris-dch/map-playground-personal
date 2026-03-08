import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type {
  SelectionToolAnalysisSummary,
  SelectionToolProgress,
} from "@/features/selection-tool/selection-tool.types";
import type { SketchAreaGeometry } from "@/features/sketch-measure/sketch-measure.types";

export interface MapSelectionToolsProps {
  readonly countyIds: readonly string[];
  readonly isLoading: boolean;
  readonly isSelectionPanelOpen: boolean;
  readonly selectionError: string | null;
  readonly selectionGeometry: SketchAreaGeometry | null;
  readonly selectionProgress: SelectionToolProgress | null;
  readonly selectionSummary: SelectionToolAnalysisSummary | null;
}

export interface MapSelectionToolsEmits {
  "clear-selection": [];
  export: [];
  "open-dashboard": [];
  "select-facility": [facility: SelectedFacilityRef];
}
