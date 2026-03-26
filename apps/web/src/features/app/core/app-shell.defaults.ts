import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  AppShellToolPanel,
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  PerspectiveStatusState,
} from "@/features/app/core/app-shell.types";
import { buildInitialFiberVisibilityState } from "@/features/app/visibility/app-shell-visibility.service";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";
import type { SketchMeasureState } from "@/features/sketch-measure/sketch-measure.types";

export function initialParcelsStatus(): ParcelsStatus {
  return {
    state: "idle",
  };
}

export function initialSketchMeasureState(): SketchMeasureState {
  return {
    areaShape: "freeform",
    mode: "off",
    vertexCount: 0,
    distanceKm: null,
    areaSqKm: null,
    canFinishArea: false,
    completedAreaGeometry: null,
    draftAreaGeometry: null,
    isAreaComplete: false,
  };
}

export function initialActiveToolPanel(): AppShellToolPanel {
  return null;
}

export function initialPerspectiveStatusState(): PerspectiveStatusState {
  return {
    colocation: { state: "idle" },
    hyperscale: { state: "idle" },
    "hyperscale-leased": { state: "idle" },
    enterprise: { state: "idle" },
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

export function isSamePerspective(
  selected: SelectedFacilityRef | null,
  perspective: FacilityPerspective
): boolean {
  if (selected === null) {
    return false;
  }

  return selected.perspective === perspective;
}
