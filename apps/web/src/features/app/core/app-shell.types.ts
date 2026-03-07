import type { BoundaryFacetOption } from "@/features/boundaries/boundaries.types";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import type {
  FiberLocatorSourceLayerOption,
  FiberLocatorStatus,
} from "@/features/fiber-locator/fiber-locator.types";

export type AppShellToolPanel = "layers" | "selection" | "sketch-measure" | null;

export interface PerspectiveStatusState {
  readonly colocation: FacilitiesStatus;
  readonly hyperscale: FacilitiesStatus;
}

export interface PerspectiveVisibilityState {
  readonly colocation: boolean;
  readonly hyperscale: boolean;
}

export interface BoundaryVisibilityState {
  readonly country: boolean;
  readonly county: boolean;
  readonly state: boolean;
}

export interface BoundaryFacetOptionsState {
  readonly country: readonly BoundaryFacetOption[];
  readonly county: readonly BoundaryFacetOption[];
  readonly state: readonly BoundaryFacetOption[];
}

export interface BoundaryFacetSelectionState {
  readonly country: readonly string[] | null;
  readonly county: readonly string[] | null;
  readonly state: readonly string[] | null;
}

export interface FiberVisibilityState {
  readonly longhaul: boolean;
  readonly metro: boolean;
}

export interface FiberSourceLayerOptionsState {
  readonly longhaul: readonly FiberLocatorSourceLayerOption[];
  readonly metro: readonly FiberLocatorSourceLayerOption[];
}

export interface FiberSourceLayerSelectionState {
  readonly longhaul: readonly string[];
  readonly metro: readonly string[];
}

export type FiberStatusState = FiberLocatorStatus;
