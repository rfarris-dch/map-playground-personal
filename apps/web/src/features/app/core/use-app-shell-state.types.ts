import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { IMap, MapControl } from "@map-migration/map-engine";
import type { ShallowRef } from "vue";
import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.types";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  PerspectiveStatusState,
} from "@/features/app/core/app-shell.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";
import type { FacilitiesLayerController } from "@/features/facilities/facilities.types";
import type {
  FacilitiesHoverController,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";
import type {
  MeasureAreaShape,
  MeasureLayerController,
  MeasureMode,
  MeasureState,
} from "@/features/measure/measure.types";
import type { ParcelsLayerController, ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import type { WaterLayerVisibilityController } from "@/features/water/water.types";

export interface UseAppShellStateResult {
  readonly basemapLayerController: ShallowRef<BasemapLayerVisibilityController | null>;
  readonly boundaryControllers: ShallowRef<BoundaryControllerState>;
  readonly boundaryFacetOptions: ShallowRef<BoundaryFacetOptionsState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly boundaryHoverByLayer: ShallowRef<BoundaryHoverByLayerState>;
  readonly clearMeasure: () => void;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly disposePmtilesProtocol: ShallowRef<(() => void) | null>;
  readonly facilitiesControllers: ShallowRef<readonly FacilitiesLayerController[]>;
  readonly facilitiesHoverController: ShallowRef<FacilitiesHoverController | null>;
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly finishMeasureSelection: () => void;
  readonly hoveredBoundary: ShallowRef<BoundaryHoverState | null>;
  readonly hoveredFacility: ShallowRef<FacilityHoverState | null>;
  readonly hoveredPower: ShallowRef<PowerHoverState | null>;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly isLayerPanelOpen: ShallowRef<boolean>;
  readonly isMeasurePanelOpen: ShallowRef<boolean>;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly map: ShallowRef<IMap | null>;
  readonly mapContainer: Readonly<ShallowRef<HTMLDivElement | null>>;
  readonly mapControls: ShallowRef<readonly MapControl[]>;
  readonly measureController: ShallowRef<MeasureLayerController | null>;
  readonly measureState: ShallowRef<MeasureState>;
  readonly parcelsController: ShallowRef<ParcelsLayerController | null>;
  readonly parcelsStatus: ShallowRef<ParcelsStatus>;
  readonly powerControllers: ShallowRef<readonly PowerLayerVisibilityController[]>;
  readonly powerHoverController: ShallowRef<PowerHoverController | null>;
  readonly restoreConsoleWarn: ShallowRef<(() => void) | null>;
  readonly setMeasureAreaShape: (shape: MeasureAreaShape) => void;
  readonly setMeasureMode: (mode: MeasureMode) => void;
  readonly setViewportFacilities: (
    perspective: FacilityPerspective,
    features: FacilitiesFeatureCollection["features"]
  ) => void;
  readonly toggleLayerPanel: () => void;
  readonly toggleMeasurePanel: () => void;
  readonly waterController: ShallowRef<WaterLayerVisibilityController | null>;
}
