import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import type { IMap, MapExpression } from "@map-migration/map-engine";
import type { ComputedRef, ShallowRef } from "vue";
import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.types";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  PerspectiveStatusState,
} from "@/features/app/core/app-shell.types";
import type { FacilitiesFilterPredicate } from "@/features/app/filters/map-filters.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";
import type {
  FacilitiesLayerController,
  SelectedFacilityRef,
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
  ParcelsLayerController,
  ParcelsStatus,
  SelectedParcelRef,
} from "@/features/parcels/parcels.types";
import type { PowerLayerVisibilityController } from "@/features/power/power.types";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import type {
  SketchMeasureLayerController,
  SketchMeasureState,
} from "@/features/sketch-measure/sketch-measure.types";
import type { WaterLayerVisibilityController } from "@/features/water/water.types";

export interface AppShellFiberLifecycleController {
  clearFiberHover(): void;
  destroy(map: IMap | null): void;
  initialize(map: IMap): void;
}

export interface AppShellVisibilityLifecycleController {
  applyBasemapVisibility(): void;
  syncRuntimeVisibility(): void;
}

export interface EnvironmentalStressController {
  destroy(): void;
}

export interface AppShellMapLifecycleRuntimeRefs {
  readonly basemapLayerController: ShallowRef<BasemapLayerVisibilityController | null>;
  readonly disposeMapRuntime: ShallowRef<(() => Promise<void>) | null>;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly map: ShallowRef<IMap | null>;
  readonly mapContainer: Readonly<ShallowRef<HTMLDivElement | null>>;
}

export interface AppShellMapLifecycleLayerRefs {
  readonly boundaryControllers: ShallowRef<BoundaryControllerState>;
  readonly environmentalStressController: ShallowRef<EnvironmentalStressController | null>;
  readonly facilitiesControllers: ShallowRef<readonly FacilitiesLayerController[]>;
  readonly facilitiesHoverController: ShallowRef<FacilitiesHoverController | null>;
  readonly floodLayersController: ShallowRef<FloodLayerMountResult | null>;
  readonly gasPipelineController: ShallowRef<GasPipelineLayerController | null>;
  readonly hydroBasinsController: ShallowRef<HydroBasinsVisibilityController | null>;
  readonly parcelsController: ShallowRef<ParcelsLayerController | null>;
  readonly powerControllers: ShallowRef<readonly PowerLayerVisibilityController[]>;
  readonly powerHoverController: ShallowRef<PowerHoverController | null>;
  readonly sketchMeasureController: ShallowRef<SketchMeasureLayerController | null>;
  readonly waterController: ShallowRef<WaterLayerVisibilityController | null>;
}

export interface AppShellMapLifecycleStateRefs {
  readonly boundaryFacetOptions: ShallowRef<BoundaryFacetOptionsState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly boundaryHoverByLayer: ShallowRef<BoundaryHoverByLayerState>;
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly hoveredBoundary: ShallowRef<BoundaryHoverState | null>;
  readonly hoveredFacility: ShallowRef<FacilityHoverState | null>;
  readonly hoveredFacilityCluster: ShallowRef<FacilityClusterHoverState | null>;
  readonly hoveredPower: ShallowRef<PowerHoverState | null>;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly layerRuntimeSnapshot: ShallowRef<LayerRuntimeSnapshot | null>;
  readonly parcelsStatus: ShallowRef<ParcelsStatus>;
  readonly selectedFacility: ShallowRef<SelectedFacilityRef | null>;
  readonly selectedParcel: ShallowRef<SelectedParcelRef | null>;
  readonly sketchMeasureState: ShallowRef<SketchMeasureState>;
}

export interface AppShellMapLifecycleSelectionActions {
  readonly clearSelectedFacility: () => void;
  readonly clearSelectedParcel: () => void;
  readonly setSelectedFacility: (facility: SelectedFacilityRef | null) => void;
  readonly setSelectedParcel: (parcel: SelectedParcelRef | null) => void;
}

export interface AppShellMapFiltersRefs {
  readonly facilitiesPredicate: Readonly<ShallowRef<FacilitiesFilterPredicate | null | undefined>>;
  readonly onCachedFeaturesUpdate: (features: FacilitiesFeatureCollection["features"]) => void;
  readonly onParcelViewportFacets: (
    facets: import("@/features/parcels/parcels.types").ParcelsViewportFacets
  ) => void;
  readonly parcelFilter: Readonly<ShallowRef<MapExpression | null | undefined>>;
  readonly parcelViewportFacets: Readonly<
    ShallowRef<import("@/features/parcels/parcels.types").ParcelsViewportFacets | null | undefined>
  >;
  readonly transmissionFilter: Readonly<ShallowRef<MapExpression | null | undefined>>;
}

export interface UseAppShellMapLifecycleOptions {
  readonly actions: AppShellMapLifecycleSelectionActions;
  readonly areFacilityInteractionsEnabled: ComputedRef<boolean>;
  readonly fiber: AppShellFiberLifecycleController;
  readonly filters: AppShellMapFiltersRefs;
  readonly initialViewport?: MapContextTransfer["viewport"];
  readonly layers: AppShellMapLifecycleLayerRefs;
  readonly runtime: AppShellMapLifecycleRuntimeRefs;
  readonly state: AppShellMapLifecycleStateRefs;
  readonly visibility: AppShellVisibilityLifecycleController;
}

export interface MountPerspectiveLayerArgs {
  readonly map: IMap;
  readonly nextControllers: FacilitiesLayerController[];
  readonly options: UseAppShellMapLifecycleOptions;
  readonly perspective: "colocation" | "hyperscale";
}
