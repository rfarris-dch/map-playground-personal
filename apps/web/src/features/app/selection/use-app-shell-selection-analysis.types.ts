import type { ShallowRef } from "vue";
import type { PerspectiveVisibilityState } from "@/features/app/core/app-shell.types";
import type { SketchAreaGeometry } from "@/features/sketch-measure/sketch-measure.types";

export interface UseAppShellSelectionAnalysisOptions {
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly includeParcels: ShallowRef<boolean>;
  readonly selectionGeometry: ShallowRef<SketchAreaGeometry | null>;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}
