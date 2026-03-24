import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { ShallowRef } from "vue";
import type { BoundaryControllerState } from "@/features/app/boundary/app-shell-boundary.types";
import type { BoundaryFacetSelectionState } from "@/features/app/core/app-shell.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type {
  CountyPowerStoryMountResult,
  CountyPowerStoryVisibilityState,
} from "@/features/county-power-story/county-power-story.types";
import type { GasPipelineLayerController } from "@/features/gas-pipelines/gas-pipelines.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";

export interface UseAppShellVisibilityOptions {
  readonly basemapLayerController: ShallowRef<BasemapLayerVisibilityController | null>;
  readonly boundaryControllers: ShallowRef<BoundaryControllerState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly clearCountyPowerStoryHover: () => void;
  readonly clearPowerHover: () => void;
  readonly clearSelectedCountyPowerStory: () => void;
  readonly clearSelectedParcel: () => void;
  readonly countyPowerStoryController: ShallowRef<CountyPowerStoryMountResult | null>;
  readonly countyPowerStoryVisibility: ShallowRef<CountyPowerStoryVisibilityState>;
  readonly gasPipelineController: ShallowRef<GasPipelineLayerController | null>;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly setViewportFacilities: (
    perspective: FacilityPerspective,
    features: FacilitiesFeatureCollection["features"]
  ) => void;
}
