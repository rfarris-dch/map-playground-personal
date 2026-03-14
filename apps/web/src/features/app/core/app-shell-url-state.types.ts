import type { MapContextSurface } from "@map-migration/http-contracts";
import type { ComputedRef, ShallowRef } from "vue";
import type {
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  FloodVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type { BasemapLayerId, BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type { LayerRuntimeSnapshot } from "@/features/layers/layer-runtime.types";
import type { PowerLayerId } from "@/features/power/power.types";

export interface UseAppShellUrlStateOptions {
  readonly basemapVisibility: ShallowRef<BasemapVisibilityState>;
  readonly boundaryFacetSelection: ShallowRef<BoundaryFacetSelectionState>;
  readonly boundaryVisibility: ShallowRef<BoundaryVisibilityState>;
  readonly currentSurface: ComputedRef<MapContextSurface>;
  readonly fiberVisibility: ShallowRef<FiberVisibilityState>;
  readonly floodVisibility: ShallowRef<FloodVisibilityState>;
  readonly hydroBasinsVisible: ShallowRef<boolean>;
  readonly layerRuntimeSnapshot: ShallowRef<LayerRuntimeSnapshot | null>;
  readonly map: ShallowRef<import("@map-migration/map-engine").IMap | null>;
  readonly parcelsVisible: ShallowRef<boolean>;
  readonly powerVisibility: ShallowRef<import("@/features/power/power.types").PowerVisibilityState>;
  readonly selectedFiberSourceLayerNames: ShallowRef<FiberSourceLayerSelectionState>;
  readonly setBasemapLayerVisible: (layerId: BasemapLayerId, visible: boolean) => void;
  readonly setBoundarySelectedRegionIds: (
    boundaryId: BoundaryLayerId,
    selectedRegionIds: readonly string[] | null
  ) => void;
  readonly setBoundaryVisible: (boundaryId: BoundaryLayerId, visible: boolean) => void;
  readonly setFiberLayerVisibility: (
    lineId: import("@/features/fiber-locator/fiber-locator.types").FiberLocatorLineId,
    visible: boolean
  ) => void;
  readonly setFiberSourceLayerSelection: (
    lineId: import("@/features/fiber-locator/fiber-locator.types").FiberLocatorLineId,
    selectedLayerNames: readonly string[]
  ) => void;
  readonly setFloodLayerVisible: (layerId: "flood100" | "flood500", visible: boolean) => void;
  readonly setHydroBasinsVisible: (visible: boolean) => void;
  readonly setParcelsVisible: (visible: boolean) => void;
  readonly setPerspectiveVisibility: (
    perspective: import("@map-migration/geo-kernel").FacilityPerspective,
    visible: boolean
  ) => void;
  readonly setPowerLayerVisible: (layerId: PowerLayerId, visible: boolean) => void;
  readonly setWaterVisible: (visible: boolean) => void;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
  readonly waterVisible: ShallowRef<boolean>;
}
