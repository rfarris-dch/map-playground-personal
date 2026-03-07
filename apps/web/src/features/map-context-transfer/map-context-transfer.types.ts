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
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";

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
  readonly setBoundarySelectedRegionIds: (
    boundaryId: BoundaryLayerId,
    selectedRegionIds: readonly string[] | null
  ) => void;
  readonly setBoundaryVisible: (boundaryId: BoundaryLayerId, visible: boolean) => void;
  readonly setPerspectiveVisibility: (perspective: FacilityPerspective, visible: boolean) => void;
}

export interface BuildMapContextTransferFromAppShellArgs {
  readonly boundaryFacetSelection: BoundaryFacetSelectionState;
  readonly companyIds?: readonly string[];
  readonly facilityIds?: readonly string[];
  readonly highlightTarget?: MapContextHighlightTarget;
  readonly map: IMap | null;
  readonly marketIds?: readonly string[];
  readonly providerIds?: readonly string[];
  readonly selectionGeometryToken?: string;
  readonly sourceSurface: MapContextSurface;
  readonly targetSurface: MapContextSurface;
  readonly visiblePerspectives: PerspectiveVisibilityState;
}
