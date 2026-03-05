import type { BBox, FacilitiesFeatureCollection } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import type { ShallowRef } from "vue";
import type { PerspectiveVisibilityState } from "@/features/app/app-shell.types";
import type { MeasureMode, MeasureState } from "@/features/measure/measure.types";

export interface MapOverlaysQueryState {
  readonly quickView: boolean;
  readonly scanner: boolean;
}

export type MapBounds = BBox;

export interface UseMapOverlaysArgs {
  readonly clearMeasure: () => void;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly finishMeasureSelection: () => void;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly map: ShallowRef<IMap | null>;
  readonly measureState: ShallowRef<MeasureState>;
  readonly setMeasureMode: (mode: MeasureMode) => void;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}
