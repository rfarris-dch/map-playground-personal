import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { ShallowRef } from "vue";
import type { BoundaryControllerState } from "@/features/app/boundary/app-shell-boundary.types";
import type { BoundaryFacetSelectionState } from "@/features/app/core/app-shell.types";
import type { BasemapLayerVisibilityController } from "@/features/basemap/basemap.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";

export interface UseAppShellVisibilityOptions {
  readonly basemapLayerController: ShallowRef<BasemapLayerVisibilityController | null>;
  readonly boundaryControllers: ShallowRef<BoundaryControllerState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly clearPowerHover: () => void;
  readonly clearSelectedParcel: () => void;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly setViewportFacilities: (
    perspective: FacilityPerspective,
    features: FacilitiesFeatureCollection["features"]
  ) => void;
}
