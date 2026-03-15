import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import {
  initialMarketBoundaryControllerState,
  initialMarketBoundaryHoverByLayerState,
  resolveMarketBoundaryHoverState,
  withMarketBoundaryController,
} from "@/features/app/market-boundary/app-shell-market-boundary.service";
import { mountMarketBoundaryLayer } from "@/features/market-boundaries/market-boundaries.layer";
import {
  marketBoundaryLayerIds,
  normalizeMarketBoundaryRegionIds,
  reconcileMarketBoundaryFacetSelection,
} from "@/features/market-boundaries/market-boundaries.service";
import type {
  MarketBoundaryFacetOption,
  MarketBoundaryHoverState,
  MarketBoundaryLayerController,
  MarketBoundaryLayerId,
} from "@/features/market-boundaries/market-boundaries.types";

function marketBoundaryControllerForId(
  options: UseAppShellMapLifecycleOptions,
  layerId: MarketBoundaryLayerId
): MarketBoundaryLayerController | null {
  return options.layers.marketBoundaryControllers.value[layerId];
}

function setMarketBoundaryHoverState(
  options: UseAppShellMapLifecycleOptions,
  layerId: MarketBoundaryLayerId,
  nextHover: MarketBoundaryHoverState | null
): void {
  const previousState = options.state.marketBoundaryHoverByLayer.value;

  if (layerId === "market") {
    options.state.marketBoundaryHoverByLayer.value = {
      market: nextHover,
      submarket: previousState.submarket,
    };
  } else {
    options.state.marketBoundaryHoverByLayer.value = {
      market: previousState.market,
      submarket: nextHover,
    };
  }

  options.state.hoveredMarketBoundary.value = resolveMarketBoundaryHoverState(
    options.state.marketBoundaryHoverByLayer.value
  );
}

function setMarketBoundaryFacetOptions(
  options: UseAppShellMapLifecycleOptions,
  layerId: MarketBoundaryLayerId,
  nextOptions: readonly MarketBoundaryFacetOption[]
): void {
  options.state.marketBoundaryFacetOptions.value = {
    ...options.state.marketBoundaryFacetOptions.value,
    [layerId]: nextOptions,
  };

  const currentSelection = options.state.marketBoundaryFacetSelection.value[layerId];
  if (currentSelection === null) {
    return;
  }

  const normalizedSelection = reconcileMarketBoundaryFacetSelection(nextOptions, currentSelection);
  options.state.marketBoundaryFacetSelection.value = {
    ...options.state.marketBoundaryFacetSelection.value,
    [layerId]: normalizedSelection,
  };
  marketBoundaryControllerForId(options, layerId)?.setIncludedRegionIds(normalizedSelection);
}

export function setMarketBoundarySelectedRegionIds(
  options: UseAppShellMapLifecycleOptions,
  layerId: MarketBoundaryLayerId,
  selectedRegionIds: readonly string[] | null
): void {
  const normalizedRegionIds = normalizeMarketBoundaryRegionIds(selectedRegionIds);
  options.state.marketBoundaryFacetSelection.value = {
    ...options.state.marketBoundaryFacetSelection.value,
    [layerId]: normalizedRegionIds,
  };
  marketBoundaryControllerForId(options, layerId)?.setIncludedRegionIds(normalizedRegionIds);
}

export function initializeMarketBoundaryRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const nextControllers = marketBoundaryLayerIds().reduce((controllers, layerId) => {
    const controller = mountMarketBoundaryLayer(currentMap, {
      layerId,
      colorMode: options.state.marketBoundaryColorMode.value,
      isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
      onFacetOptionsChange: (currentLayerId, nextOptions) => {
        setMarketBoundaryFacetOptions(options, currentLayerId, nextOptions);
      },
      onHoverChange: (nextHover) => {
        setMarketBoundaryHoverState(options, layerId, nextHover);
      },
    });
    controller.setIncludedRegionIds(options.state.marketBoundaryFacetSelection.value[layerId]);
    const catalogId = layerId === "market" ? "markets.market" : "markets.submarket";
    options.runtime.layerRuntime.value?.registerLayerController(catalogId, controller);
    return withMarketBoundaryController(controllers, layerId, controller);
  }, initialMarketBoundaryControllerState());

  options.layers.marketBoundaryControllers.value = nextControllers;
}

export function resetMarketBoundaryRuntime(options: UseAppShellMapLifecycleOptions): void {
  marketBoundaryLayerIds().reduce((_, layerId) => {
    options.layers.marketBoundaryControllers.value[layerId]?.clearHover();
    return 0;
  }, 0);
  options.state.marketBoundaryHoverByLayer.value = initialMarketBoundaryHoverByLayerState();
  options.state.hoveredMarketBoundary.value = null;
}

export function destroyMarketBoundaryRuntime(options: UseAppShellMapLifecycleOptions): void {
  for (const layerId of marketBoundaryLayerIds()) {
    const catalogId = layerId === "market" ? "markets.market" : "markets.submarket";
    options.runtime.layerRuntime.value?.unregisterLayerController(catalogId);
  }
  for (const layerId of marketBoundaryLayerIds()) {
    options.layers.marketBoundaryControllers.value[layerId]?.destroy();
  }
  options.layers.marketBoundaryControllers.value = initialMarketBoundaryControllerState();
  options.state.marketBoundaryFacetOptions.value = initialMarketBoundaryFacetOptionsState();
  options.state.marketBoundaryFacetSelection.value = initialMarketBoundaryFacetSelectionState();
  options.state.marketBoundaryHoverByLayer.value = initialMarketBoundaryHoverByLayerState();
  options.state.hoveredMarketBoundary.value = null;
}

export function initialMarketBoundaryFacetOptionsState(): {
  readonly market: readonly MarketBoundaryFacetOption[];
  readonly submarket: readonly MarketBoundaryFacetOption[];
} {
  return {
    market: [],
    submarket: [],
  };
}

export function initialMarketBoundaryFacetSelectionState(): {
  readonly market: readonly string[] | null;
  readonly submarket: readonly string[] | null;
} {
  return {
    market: null,
    submarket: null,
  };
}
