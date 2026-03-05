import type {
  BoundaryHoverState,
  BoundaryLayerController,
} from "@/features/boundaries/boundaries.types";

export interface BoundaryHoverByLayerState {
  readonly country: BoundaryHoverState | null;
  readonly county: BoundaryHoverState | null;
  readonly state: BoundaryHoverState | null;
}

export interface BoundaryControllerState {
  readonly country: BoundaryLayerController | null;
  readonly county: BoundaryLayerController | null;
  readonly state: BoundaryLayerController | null;
}
