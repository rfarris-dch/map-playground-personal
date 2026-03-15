import type {
  MarketBoundaryControllerState,
  MarketBoundaryHoverByLayerState,
} from "@/features/app/market-boundary/app-shell-market-boundary.types";
import type {
  MarketBoundaryHoverState,
  MarketBoundaryLayerId,
} from "@/features/market-boundaries/market-boundaries.types";

export function initialMarketBoundaryControllerState(): MarketBoundaryControllerState {
  return {
    market: null,
    submarket: null,
  };
}

export function withMarketBoundaryController(
  state: MarketBoundaryControllerState,
  layerId: MarketBoundaryLayerId,
  controller: MarketBoundaryControllerState[MarketBoundaryLayerId]
): MarketBoundaryControllerState {
  if (layerId === "market") {
    return {
      market: controller,
      submarket: state.submarket,
    };
  }

  return {
    market: state.market,
    submarket: controller,
  };
}

export function initialMarketBoundaryHoverByLayerState(): MarketBoundaryHoverByLayerState {
  return {
    market: null,
    submarket: null,
  };
}

export function resolveMarketBoundaryHoverState(
  hoverByLayer: MarketBoundaryHoverByLayerState
): MarketBoundaryHoverState | null {
  return hoverByLayer.market ?? hoverByLayer.submarket;
}
