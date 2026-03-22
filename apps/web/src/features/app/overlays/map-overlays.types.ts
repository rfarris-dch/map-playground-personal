import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { IMap } from "@map-migration/map-engine";
import type { ComputedRef, ShallowRef } from "vue";
import type {
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type { MapInteractionCoordinator } from "@/features/app/interaction/map-interaction.types";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";
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
  readonly clearSelectionGeometry: () => void;
  readonly clearSketchMeasure: () => void;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly dismissAllToolPanels: () => void;
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly finishSketchMeasureArea: () => void;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly interactionCoordinator: ShallowRef<MapInteractionCoordinator | null>;
  readonly isSketchMeasurePanelOpen: ComputedRef<boolean>;
  readonly map: ShallowRef<IMap | null>;
  readonly parcelsStatus: ShallowRef<ParcelsStatus>;
  readonly setSketchMeasureMode: (mode: SketchMeasureMode) => void;
  readonly sketchMeasureState: ShallowRef<SketchMeasureState>;
  readonly toggleSketchMeasurePanel: () => void;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}
