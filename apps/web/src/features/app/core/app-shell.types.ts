import type { BoundaryFacetOption } from "@/features/boundaries/boundaries.types";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import type {
  FiberLocatorSourceLayerOption,
  FiberLocatorStatus,
} from "@/features/fiber-locator/fiber-locator.types";

export type AppShellToolPanel = "layers" | "selection" | "sketch-measure" | null;

export interface PerspectiveStatusState {
  readonly colocation: FacilitiesStatus;
  readonly enterprise: FacilitiesStatus;
  readonly hyperscale: FacilitiesStatus;
  readonly "hyperscale-leased": FacilitiesStatus;
}

export interface PerspectiveVisibilityState {
  readonly colocation: boolean;
  readonly enterprise: boolean;
  readonly hyperscale: boolean;
  readonly "hyperscale-leased": boolean;
}

export interface FloodVisibilityState {
  readonly flood100: boolean;
  readonly flood500: boolean;
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
