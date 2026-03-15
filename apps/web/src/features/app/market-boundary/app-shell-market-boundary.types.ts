import type {
  MarketBoundaryHoverState,
  MarketBoundaryLayerController,
} from "@/features/market-boundaries/market-boundaries.types";

export interface MarketBoundaryHoverByLayerState {
  readonly market: MarketBoundaryHoverState | null;
  readonly submarket: MarketBoundaryHoverState | null;
}

export interface MarketBoundaryControllerState {
  readonly market: MarketBoundaryLayerController | null;
  readonly submarket: MarketBoundaryLayerController | null;
}
