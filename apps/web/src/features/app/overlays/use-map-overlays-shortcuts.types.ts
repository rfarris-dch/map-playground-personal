import type { ComputedRef, ShallowRef } from "vue";
import type {
  SketchMeasureMode,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";

export interface UseMapOverlaysShortcutsOptions {
  readonly clearSelectionGeometry: () => void;
  readonly clearSketchMeasure: () => void;
  readonly finishSketchMeasureArea: () => void;
  readonly isSketchMeasurePanelOpen: ComputedRef<boolean>;
  readonly quickViewDisabledReason: ComputedRef<string | null>;
  readonly setSketchMeasureMode: (mode: SketchMeasureMode) => void;
  readonly sketchMeasureState: ShallowRef<SketchMeasureState>;
  readonly toggleSketchMeasurePanel: () => void;
}
