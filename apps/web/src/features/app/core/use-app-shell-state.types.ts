import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { IMap } from "@map-migration/map-engine";
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
import type {
  BoundaryFetchErrorState,
  EnvironmentalStressController,
  MapInitStatus,
  MarketBoundaryFacetOptionsState,
  MarketBoundaryFacetSelectionState,
  MarketBoundaryFetchErrorState,
} from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import type {
  MarketBoundaryControllerState,
  MarketBoundaryHoverByLayerState,
} from "@/features/app/market-boundary/app-shell-market-boundary.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";
import type {
  FacilitiesLayerController,
  FacilitiesViewMode,
} from "@/features/facilities/facilities.types";
import type {
  FacilitiesHoverController,
  FacilityClusterHoverState,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import type { FloodLayerMountResult } from "@/features/flood/flood-layer.types";
import type { GasPipelineLayerController } from "@/features/gas-pipelines/gas-pipelines.types";
import type { HydroBasinsVisibilityController } from "@/features/hydro-basins/hydro-basins.types";
import type {
  LayerRuntimeController,
  LayerRuntimeSnapshot,
} from "@/features/layers/layer-runtime.types";
import type {
  MarketBoundaryColorMode,
  MarketBoundaryHoverState,
} from "@/features/market-boundaries/market-boundaries.types";
import type { ParcelsLayerController, ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerLayerMountResult } from "@/features/power/power.layer.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import type {
  SketchAreaGeometry,
  SketchMeasureAreaShape,
  SketchMeasureLayerController,
  SketchMeasureMode,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";
import type { WaterLayerVisibilityController } from "@/features/water/water.types";

export interface PerspectiveViewModeState {
  readonly colocation: FacilitiesViewMode;
  readonly hyperscale: FacilitiesViewMode;
  readonly "hyperscale-leased": FacilitiesViewMode;
  readonly enterprise: FacilitiesViewMode;
}

export interface UseAppShellStateResult {
  readonly activeToolPanel: ShallowRef<AppShellToolPanel>;
  readonly basemapLayerController: ShallowRef<BasemapLayerVisibilityController | null>;
  readonly boundaryControllers: ShallowRef<BoundaryControllerState>;
  readonly boundaryFacetOptions: ShallowRef<BoundaryFacetOptionsState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly boundaryFetchError: ShallowRef<BoundaryFetchErrorState>;
  readonly boundaryHoverByLayer: ShallowRef<BoundaryHoverByLayerState>;
  readonly clearSelectionGeometry: () => void;
  readonly clearSketchMeasure: () => void;
  readonly clusterClickSignal: ShallowRef<number>;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly dismissAllToolPanels: () => void;
  readonly disposeMapRuntime: ShallowRef<(() => Promise<void>) | null>;
  readonly environmentalStressController: ShallowRef<EnvironmentalStressController | null>;
  readonly facilitiesControllers: ShallowRef<readonly FacilitiesLayerController[]>;
  readonly facilitiesHoverController: ShallowRef<FacilitiesHoverController | null>;
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly finishSketchMeasureArea: () => void;
  readonly floodLayersController: ShallowRef<FloodLayerMountResult | null>;
  readonly gasPipelineController: ShallowRef<GasPipelineLayerController | null>;
  readonly hoveredBoundary: ShallowRef<BoundaryHoverState | null>;
  readonly hoveredFacility: ShallowRef<FacilityHoverState | null>;
  readonly hoveredFacilityCluster: ShallowRef<FacilityClusterHoverState | null>;
  readonly hoveredMarketBoundary: ShallowRef<MarketBoundaryHoverState | null>;
  readonly hoveredPower: ShallowRef<PowerHoverState | null>;
  readonly hydroBasinsController: ShallowRef<HydroBasinsVisibilityController | null>;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly isLayerPanelOpen: ComputedRef<boolean>;
  readonly isSelectionPanelOpen: ComputedRef<boolean>;
  readonly isSketchMeasurePanelOpen: ComputedRef<boolean>;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly layerRuntimeSnapshot: ShallowRef<LayerRuntimeSnapshot | null>;
  readonly map: ShallowRef<IMap | null>;
  readonly mapContainer: Readonly<ShallowRef<HTMLDivElement | null>>;
  readonly mapInitStatus: ShallowRef<MapInitStatus>;
  readonly marketBoundaryColorMode: ShallowRef<MarketBoundaryColorMode>;
  readonly marketBoundaryControllers: ShallowRef<MarketBoundaryControllerState>;
  readonly marketBoundaryFacetOptions: ShallowRef<MarketBoundaryFacetOptionsState>;
  readonly marketBoundaryFacetSelection: ShallowRef<MarketBoundaryFacetSelectionState>;
  readonly marketBoundaryFetchError: ShallowRef<MarketBoundaryFetchErrorState>;
  readonly marketBoundaryHoverByLayer: ShallowRef<MarketBoundaryHoverByLayerState>;
  readonly parcelsController: ShallowRef<ParcelsLayerController | null>;
  readonly parcelsStatus: ShallowRef<ParcelsStatus>;
  readonly perspectiveViewModes: ShallowRef<PerspectiveViewModeState>;
  readonly powerHoverController: ShallowRef<PowerHoverController | null>;
  readonly powerLayersController: ShallowRef<PowerLayerMountResult | null>;
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
