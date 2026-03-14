import {
  initialBoundaryControllerState,
  initialBoundaryHoverByLayerState,
  resolveBoundaryHoverState,
  withBoundaryController,
} from "@/features/app/boundary/app-shell-boundary.service";
import {
  initialBoundaryFacetOptionsState,
  initialBoundaryFacetSelectionState,
} from "@/features/app/core/app-shell.defaults";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountBoundaryLayer } from "@/features/boundaries/boundaries.layer";
import {
  boundaryLayerIds,
  normalizeBoundaryRegionIds,
  reconcileBoundaryFacetSelection,
} from "@/features/boundaries/boundaries.service";
import type {
  BoundaryFacetOption,
  BoundaryHoverState,
  BoundaryLayerController,
  BoundaryLayerId,
} from "@/features/boundaries/boundaries.types";

function boundaryControllerForId(
  options: UseAppShellMapLifecycleOptions,
  boundaryId: BoundaryLayerId
): BoundaryLayerController | null {
  return options.layers.boundaryControllers.value[boundaryId];
}

function setBoundaryHoverState(
  options: UseAppShellMapLifecycleOptions,
  boundaryId: BoundaryLayerId,
  nextHover: BoundaryHoverState | null
): void {
  const previousState = options.state.boundaryHoverByLayer.value;

  if (boundaryId === "county") {
    options.state.boundaryHoverByLayer.value = {
      county: nextHover,
      state: previousState.state,
      country: previousState.country,
    };
  } else if (boundaryId === "state") {
    options.state.boundaryHoverByLayer.value = {
      county: previousState.county,
      state: nextHover,
      country: previousState.country,
    };
  } else {
    options.state.boundaryHoverByLayer.value = {
      county: previousState.county,
      state: previousState.state,
      country: nextHover,
    };
  }

  options.state.hoveredBoundary.value = resolveBoundaryHoverState(
    options.state.boundaryHoverByLayer.value
  );
}

function setBoundaryFacetOptions(
  options: UseAppShellMapLifecycleOptions,
  boundaryId: BoundaryLayerId,
  nextOptions: readonly BoundaryFacetOption[]
): void {
  options.state.boundaryFacetOptions.value = {
    ...options.state.boundaryFacetOptions.value,
    [boundaryId]: nextOptions,
  };

  const currentSelection = options.state.boundaryFacetSelection.value[boundaryId];
  if (currentSelection === null) {
    return;
  }

  const normalizedSelection = reconcileBoundaryFacetSelection(nextOptions, currentSelection);
  options.state.boundaryFacetSelection.value = {
    ...options.state.boundaryFacetSelection.value,
    [boundaryId]: normalizedSelection,
  };
  boundaryControllerForId(options, boundaryId)?.setIncludedRegionIds(normalizedSelection);
}

export function setBoundarySelectedRegionIds(
  options: UseAppShellMapLifecycleOptions,
  boundaryId: BoundaryLayerId,
  selectedRegionIds: readonly string[] | null
): void {
  const normalizedRegionIds = normalizeBoundaryRegionIds(selectedRegionIds);
  options.state.boundaryFacetSelection.value = {
    ...options.state.boundaryFacetSelection.value,
    [boundaryId]: normalizedRegionIds,
  };
  boundaryControllerForId(options, boundaryId)?.setIncludedRegionIds(normalizedRegionIds);
}

export function initializeBoundaryRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const nextBoundaryControllers = boundaryLayerIds().reduce((controllers, boundaryId) => {
    const controller = mountBoundaryLayer(currentMap, {
      layerId: boundaryId,
      isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
      onFacetOptionsChange: (currentBoundaryId, nextOptions) => {
        setBoundaryFacetOptions(options, currentBoundaryId, nextOptions);
      },
      onHoverChange: (nextHover) => {
        setBoundaryHoverState(options, boundaryId, nextHover);
      },
    });
    controller.setIncludedRegionIds(options.state.boundaryFacetSelection.value[boundaryId]);
    options.runtime.layerRuntime.value?.registerLayerController(boundaryId, controller);
    return withBoundaryController(controllers, boundaryId, controller);
  }, initialBoundaryControllerState());

  options.layers.boundaryControllers.value = nextBoundaryControllers;
}

export function resetBoundaryRuntime(options: UseAppShellMapLifecycleOptions): void {
  boundaryLayerIds().reduce((_, boundaryId) => {
    options.layers.boundaryControllers.value[boundaryId]?.clearHover();
    return 0;
  }, 0);
  options.state.boundaryHoverByLayer.value = initialBoundaryHoverByLayerState();
  options.state.hoveredBoundary.value = null;
}

export function destroyBoundaryRuntime(options: UseAppShellMapLifecycleOptions): void {
  for (const id of boundaryLayerIds()) {
    options.runtime.layerRuntime.value?.unregisterLayerController(id);
  }
  for (const boundaryId of boundaryLayerIds()) {
    options.layers.boundaryControllers.value[boundaryId]?.destroy();
  }
  options.layers.boundaryControllers.value = initialBoundaryControllerState();
  options.state.boundaryFacetOptions.value = initialBoundaryFacetOptionsState();
  options.state.boundaryFacetSelection.value = initialBoundaryFacetSelectionState();
  options.state.boundaryHoverByLayer.value = initialBoundaryHoverByLayerState();
  options.state.hoveredBoundary.value = null;
}
