import type { BBox, FacilitiesFeatureCollection } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import type { ShallowRef } from "vue";
import type {
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type {
  SketchMeasureMode,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";

export interface MapOverlaysQueryState {
  readonly quickView: boolean;
  readonly scanner: boolean;
}

export type MapBounds = BBox;

export interface UseMapOverlaysArgs {
  readonly clearSketchMeasure: () => void;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly finishSketchMeasureArea: () => void;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly map: ShallowRef<IMap | null>;
  readonly setSketchMeasureMode: (mode: SketchMeasureMode) => void;
  readonly sketchMeasureState: ShallowRef<SketchMeasureState>;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}
