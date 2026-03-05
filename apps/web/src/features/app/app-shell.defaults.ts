import type { FacilityPerspective } from "@map-migration/contracts";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { MeasureState } from "@/features/measure/measure.types";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerVisibilityState } from "@/features/power/power.types";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "./app-shell.types";

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
  };
}

export function initialPerspectiveStatusState(): PerspectiveStatusState {
  return {
    colocation: { state: "idle" },
    hyperscale: { state: "idle" },
  };
}

export function initialPerspectiveVisibilityState(): PerspectiveVisibilityState {
  return {
    colocation: true,
    hyperscale: true,
  };
}

export function initialBoundaryVisibilityState(): BoundaryVisibilityState {
  return {
    county: false,
    state: false,
    country: false,
  };
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
  return {
    metro: false,
    longhaul: false,
  };
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
  return {
    transmission: false,
    substations: true,
    plants: true,
  };
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
