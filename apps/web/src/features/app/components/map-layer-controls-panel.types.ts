import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  FloodVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type { BasemapLayerId, BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type { FacilitiesViewMode } from "@/features/facilities/facilities.types";
import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
import type { PowerLayerId, PowerVisibilityState } from "@/features/power/power.types";

export interface MapLayerControlsPanelProps {
  readonly basemapVisibility: BasemapVisibilityState;
  readonly boundaryFacetOptions: BoundaryFacetOptionsState;
  readonly boundaryFacetSelection: BoundaryFacetSelectionState;
  readonly boundaryVisibility: BoundaryVisibilityState;
  readonly colocationStatusText: string;
  readonly fiberSourceLayerOptions: FiberSourceLayerOptionsState;
  readonly fiberStatusText: string;
  readonly floodVisibility: FloodVisibilityState;
  readonly gasPipelineVisible: boolean;
  readonly hydroBasinsVisible: boolean;
  readonly hyperscaleStatusText: string;
  readonly isOpen: boolean;
  readonly parcelsStatusText: string;
  readonly parcelsVisible: boolean;
  readonly powerVisibility: PowerVisibilityState;
  readonly selectedFiberSourceLayerNames: FiberSourceLayerSelectionState;
  readonly showFlood100ZoomHint: boolean;
  readonly showFlood500ZoomHint: boolean;
  readonly showHydroBasinsZoomHint: boolean;
  readonly visibleFiberLayers: FiberVisibilityState;
  readonly visiblePerspectives: PerspectiveVisibilityState;
  readonly waterVisible: boolean;
}

export interface MapLayerControlsPanelEmits {
  "set-all-fiber-source-layers": [lineId: FiberLocatorLineId, visible: boolean];
  "toggle-fiber-source-layer": [lineId: FiberLocatorLineId, layerName: string, visible: boolean];
  "toggle-panel": [];
  "update:basemap-layer-visible": [layerId: BasemapLayerId, visible: boolean];
  "update:boundary-selected-region-ids": [
    boundaryId: BoundaryLayerId,
    regionIds: readonly string[] | null,
  ];
  "update:boundary-visible": [boundaryId: BoundaryLayerId, visible: boolean];
  "update:fiber-layer-visibility": [lineId: FiberLocatorLineId, visible: boolean];
  "update:flood-layer-visible": [layerId: keyof FloodVisibilityState, visible: boolean];
  "update:gas-pipeline-visible": [visible: boolean];
  "update:hydro-basins-visible": [visible: boolean];
  "update:parcels-visible": [visible: boolean];
  "update:perspective-view-mode": [perspective: FacilityPerspective, mode: FacilitiesViewMode];
  "update:perspective-visibility": [perspective: FacilityPerspective, visible: boolean];
  "update:power-layer-visible": [layerId: PowerLayerId, visible: boolean];
  "update:water-visible": [visible: boolean];
}
