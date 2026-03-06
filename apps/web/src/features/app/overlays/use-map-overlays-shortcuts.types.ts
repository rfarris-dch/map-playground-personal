import type { ComputedRef, ShallowRef } from "vue";
import type { MeasureMode, MeasureState } from "@/features/measure/measure.types";

export interface UseMapOverlaysShortcutsOptions {
  readonly clearMeasure: () => void;
  readonly finishMeasureSelection: () => void;
  readonly measureState: ShallowRef<MeasureState>;
  readonly quickViewDisabledReason: ComputedRef<string | null>;
  readonly setMeasureMode: (mode: MeasureMode) => void;
}
