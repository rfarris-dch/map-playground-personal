import type { FacilityPerspective } from "@map-migration/contracts";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import {
  buildInitialBasemapVisibilityState,
  buildInitialBoundaryVisibilityState,
  buildInitialFiberVisibilityState,
  buildInitialParcelsVisible,
  buildInitialPerspectiveVisibilityState,
  buildInitialPowerVisibilityState,
} from "@/features/app/visibility/app-shell-visibility.service";
import type { BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { MeasureState } from "@/features/measure/measure.types";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerVisibilityState } from "@/features/power/power.types";

export function initialParcelsStatus(): ParcelsStatus {
  return {
    state: "idle",
  };
}

export function initialMeasureState(): MeasureState {
  return {
    areaShape: "freeform",
    mode: "off",
    vertexCount: 0,
    distanceKm: null,
    areaSqKm: null,
    canFinishSelection: false,
    isSelectionComplete: false,
    selectionRing: null,
  };
}

export function initialPerspectiveStatusState(): PerspectiveStatusState {
  return {
    colocation: { state: "idle" },
    hyperscale: { state: "idle" },
  };
}

export function initialPerspectiveVisibilityState(): PerspectiveVisibilityState {
  return buildInitialPerspectiveVisibilityState();
}

export function initialBoundaryVisibilityState(): BoundaryVisibilityState {
  return buildInitialBoundaryVisibilityState();
}

export function initialBoundaryFacetOptionsState(): BoundaryFacetOptionsState {
  return {
    county: [],
    state: [],
    country: [],
  };
}

export function initialBoundaryFacetSelectionState(): BoundaryFacetSelectionState {
  return {
    county: null,
    state: null,
    country: null,
  };
}

export function initialFiberVisibilityState(): FiberVisibilityState {
  return buildInitialFiberVisibilityState();
}

export function initialFiberSourceLayerOptionsState(): FiberSourceLayerOptionsState {
  return {
    metro: [],
    longhaul: [],
  };
}

export function initialFiberSourceLayerSelectionState(): FiberSourceLayerSelectionState {
  return {
    metro: [],
    longhaul: [],
  };
}

export function initialPowerVisibilityState(): PowerVisibilityState {
  return buildInitialPowerVisibilityState();
}

export function initialParcelsVisible(): boolean {
  return buildInitialParcelsVisible();
}

export function initialBasemapVisibilityState(): BasemapVisibilityState {
  return buildInitialBasemapVisibilityState();
}

export function isSamePerspective(
  selected: SelectedFacilityRef | null,
  perspective: FacilityPerspective
): boolean {
  if (selected === null) {
    return false;
  }

  return selected.perspective === perspective;
}
