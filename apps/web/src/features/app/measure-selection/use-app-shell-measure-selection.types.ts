import type { IMap } from "@map-migration/map-engine";
import type { ShallowRef } from "vue";
import type { PerspectiveVisibilityState } from "@/features/app/core/app-shell.types";
import type {
  MeasureSelectionImageSubject,
  MeasureSelectionOutputMode,
} from "@/features/app/measure-selection/measure-selection.types";
import type { MeasureState } from "@/features/measure/measure.types";

export interface UseAppShellMeasureSelectionOptions {
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly imageSubject: ShallowRef<MeasureSelectionImageSubject>;
  readonly includeParcels: ShallowRef<boolean>;
  readonly map: ShallowRef<IMap | null>;
  readonly measureState: ShallowRef<MeasureState>;
  readonly outputMode: ShallowRef<MeasureSelectionOutputMode>;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}
