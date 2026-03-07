import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { SelectionToolSummary } from "@/features/selection-tool/selection-tool.types";
import type { SketchAreaGeometry } from "@/features/sketch-measure/sketch-measure.types";

export interface MapSelectionToolsProps {
  readonly isLoading: boolean;
  readonly isSelectionPanelOpen: boolean;
  readonly selectionError: string | null;
  readonly selectionGeometry: SketchAreaGeometry | null;
  readonly selectionSummary: SelectionToolSummary | null;
}

export interface MapSelectionToolsEmits {
  "clear-selection": [];
  export: [];
  "open-dashboard": [];
  "select-facility": [facility: SelectedFacilityRef];
}
