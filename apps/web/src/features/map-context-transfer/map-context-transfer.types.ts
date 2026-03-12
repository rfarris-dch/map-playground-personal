import type {
  FacilityPerspective,
  MapContextHighlightTarget,
  MapContextSurface,
  MapContextTransfer,
} from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type {
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  FloodVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type { BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
import type { LayerRuntimeSnapshot } from "@/features/layers/layer-runtime.types";
import type { PowerLayerId } from "@/features/power/power.types";

export interface MapContextTransferStore {
  load(token: string): MapContextTransfer | null;
  save(context: MapContextTransfer): string;
}

export interface ReadMapContextTransferFromRouteArgs {
  readonly route: RouteLocationNormalizedLoaded;
  readonly store?: MapContextTransferStore;
}

export interface ApplyMapContextTransferToAppShellArgs {
  readonly context: MapContextTransfer | null;
  readonly setBasemapLayerVisible?: (
    layerId: keyof BasemapVisibilityState,
    visible: boolean
  ) => void;
  readonly setBoundarySelectedRegionIds: (
    boundaryId: BoundaryLayerId,
    selectedRegionIds: readonly string[] | null
  ) => void;
  readonly setBoundaryVisible: (boundaryId: BoundaryLayerId, visible: boolean) => void;
  readonly setFiberLayerVisibility?: (lineId: FiberLocatorLineId, visible: boolean) => void;
  readonly setFiberSourceLayerSelection?: (
    lineId: FiberLocatorLineId,
    selectedLayerNames: readonly string[]
  ) => void;
  readonly setFloodLayerVisible?: (layerId: "flood100" | "flood500", visible: boolean) => void;
  readonly setHydroBasinsVisible?: (visible: boolean) => void;
  readonly setMapViewport?: (viewport: NonNullable<MapContextTransfer["viewport"]>) => void;
  readonly setParcelsVisible?: (visible: boolean) => void;
  readonly setPerspectiveVisibility: (perspective: FacilityPerspective, visible: boolean) => void;
  readonly setPowerLayerVisible?: (layerId: PowerLayerId, visible: boolean) => void;
  readonly setWaterVisible?: (visible: boolean) => void;
}

export interface BuildMapContextTransferFromAppShellArgs {
  readonly basemapVisibility?: BasemapVisibilityState;
  readonly boundaryFacetSelection: BoundaryFacetSelectionState;
  readonly boundaryVisibility?: BoundaryVisibilityState;
  readonly companyIds?: readonly string[];
  readonly facilityIds?: readonly string[];
  readonly fiberVisibility?: FiberVisibilityState;
  readonly floodVisibility?: FloodVisibilityState;
  readonly highlightTarget?: MapContextHighlightTarget;
  readonly hydroBasinsVisible?: boolean;
  readonly layerRuntimeSnapshot?: LayerRuntimeSnapshot | null;
  readonly map: IMap | null;
  readonly marketIds?: readonly string[];
  readonly parcelsVisible?: boolean;
  readonly powerVisibility?: import("@/features/power/power.types").PowerVisibilityState;
  readonly providerIds?: readonly string[];
  readonly selectedFiberSourceLayerNames?: FiberSourceLayerSelectionState;
  readonly selectionGeometryToken?: string;
  readonly sourceSurface: MapContextSurface;
  readonly targetSurface: MapContextSurface;
  readonly visiblePerspectives: PerspectiveVisibilityState;
  readonly waterVisible?: boolean;
}
