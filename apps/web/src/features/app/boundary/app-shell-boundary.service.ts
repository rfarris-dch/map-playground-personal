import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/boundary/app-shell-boundary.types";
import type { BoundaryHoverState, BoundaryLayerId } from "@/features/boundaries/boundaries.types";

export function initialBoundaryControllerState(): BoundaryControllerState {
  return {
    county: null,
    state: null,
    country: null,
  };
}

export function withBoundaryController(
  state: BoundaryControllerState,
  boundaryId: BoundaryLayerId,
  controller: BoundaryControllerState[BoundaryLayerId]
): BoundaryControllerState {
  if (boundaryId === "county") {
    return {
      county: controller,
      state: state.state,
      country: state.country,
    };
  }

  if (boundaryId === "state") {
    return {
      county: state.county,
      state: controller,
      country: state.country,
    };
  }

  return {
    county: state.county,
    state: state.state,
    country: controller,
  };
}

export function initialBoundaryHoverByLayerState(): BoundaryHoverByLayerState {
  return {
    county: null,
    state: null,
    country: null,
  };
}

export function resolveBoundaryHoverState(
  hoverByLayer: BoundaryHoverByLayerState
): BoundaryHoverState | null {
  return hoverByLayer.county ?? hoverByLayer.state ?? hoverByLayer.country;
}
