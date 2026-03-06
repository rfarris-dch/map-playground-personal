import type { ShallowRef } from "vue";
import type { PerspectiveVisibilityState } from "@/features/app/core/app-shell.types";
import type { MeasureState } from "@/features/measure/measure.types";

export interface UseAppShellMeasureSelectionOptions {
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly measureState: ShallowRef<MeasureState>;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}
