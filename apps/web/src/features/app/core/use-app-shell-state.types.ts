import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { IMap, MapControl } from "@map-migration/map-engine";
import type { ComputedRef, ShallowRef } from "vue";
import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.types";
import type {
  AppShellToolPanel,
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
import type { ParcelsLayerController, ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import type {
  SketchAreaGeometry,
  SketchMeasureAreaShape,
  SketchMeasureLayerController,
  SketchMeasureMode,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";
import type { WaterLayerVisibilityController } from "@/features/water/water.types";

export interface UseAppShellStateResult {
  readonly activeToolPanel: ShallowRef<AppShellToolPanel>;
  readonly basemapLayerController: ShallowRef<BasemapLayerVisibilityController | null>;
  readonly boundaryControllers: ShallowRef<BoundaryControllerState>;
  readonly boundaryFacetOptions: ShallowRef<BoundaryFacetOptionsState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly boundaryHoverByLayer: ShallowRef<BoundaryHoverByLayerState>;
  readonly clearSelectionGeometry: () => void;
  readonly clearSketchMeasure: () => void;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly disposePmtilesProtocol: ShallowRef<(() => void) | null>;
  readonly facilitiesControllers: ShallowRef<readonly FacilitiesLayerController[]>;
  readonly facilitiesHoverController: ShallowRef<FacilitiesHoverController | null>;
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly finishSketchMeasureArea: () => void;
  readonly hoveredBoundary: ShallowRef<BoundaryHoverState | null>;
  readonly hoveredFacility: ShallowRef<FacilityHoverState | null>;
  readonly hoveredPower: ShallowRef<PowerHoverState | null>;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly isLayerPanelOpen: ComputedRef<boolean>;
  readonly isSelectionPanelOpen: ComputedRef<boolean>;
  readonly isSketchMeasurePanelOpen: ComputedRef<boolean>;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly map: ShallowRef<IMap | null>;
  readonly mapContainer: Readonly<ShallowRef<HTMLDivElement | null>>;
  readonly mapControls: ShallowRef<readonly MapControl[]>;
  readonly parcelsController: ShallowRef<ParcelsLayerController | null>;
  readonly parcelsStatus: ShallowRef<ParcelsStatus>;
  readonly powerControllers: ShallowRef<readonly PowerLayerVisibilityController[]>;
  readonly powerHoverController: ShallowRef<PowerHoverController | null>;
  readonly restoreConsoleWarn: ShallowRef<(() => void) | null>;
  readonly selectionGeometry: ShallowRef<SketchAreaGeometry | null>;
  readonly setSketchMeasureAreaShape: (shape: SketchMeasureAreaShape) => void;
  readonly setSketchMeasureMode: (mode: SketchMeasureMode) => void;
  readonly setViewportFacilities: (
    perspective: FacilityPerspective,
    features: FacilitiesFeatureCollection["features"]
  ) => void;
  readonly sketchMeasureController: ShallowRef<SketchMeasureLayerController | null>;
  readonly sketchMeasureState: ShallowRef<SketchMeasureState>;
  readonly toggleLayerPanel: () => void;
  readonly toggleSelectionPanel: () => void;
  readonly toggleSketchMeasurePanel: () => void;
  readonly useCompletedSketchAsSelection: () => void;
  readonly waterController: ShallowRef<WaterLayerVisibilityController | null>;
}
