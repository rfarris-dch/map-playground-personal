import type {
  SketchMeasureAreaShape,
  SketchMeasureMode,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";

export interface MapSketchMeasureToolsProps {
  readonly isSketchMeasurePanelOpen: boolean;
  readonly sketchMeasureState: SketchMeasureState;
}

export interface MapSketchMeasureToolsEmits {
  clear: [];
  finish: [];
  "set-area-shape": [shape: SketchMeasureAreaShape];
  "set-mode": [mode: SketchMeasureMode];
  "use-as-selection": [];
}
