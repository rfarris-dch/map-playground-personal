import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  AppShellToolPanel,
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
  FloodVisibilityState,
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import {
  buildInitialBasemapVisibilityState,
  buildInitialBoundaryVisibilityState,
  buildInitialFiberVisibilityState,
  buildInitialFloodVisibilityState,
  buildInitialHydroBasinsVisible,
  buildInitialParcelsVisible,
  buildInitialPerspectiveVisibilityState,
  buildInitialPowerVisibilityState,
  buildInitialWaterVisible,
} from "@/features/app/visibility/app-shell-visibility.service";
import type { BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";
import type { PowerVisibilityState } from "@/features/power/power.types";
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
  };
}

export function initialPerspectiveVisibilityState(): PerspectiveVisibilityState {
  return buildInitialPerspectiveVisibilityState();
}

export function initialBoundaryVisibilityState(): BoundaryVisibilityState {
  return buildInitialBoundaryVisibilityState();
}

export function initialFloodVisibilityState(): FloodVisibilityState {
  return buildInitialFloodVisibilityState();
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

export function initialHydroBasinsVisible(): boolean {
  return buildInitialHydroBasinsVisible();
}

export function initialWaterVisible(): boolean {
  return buildInitialWaterVisible();
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
