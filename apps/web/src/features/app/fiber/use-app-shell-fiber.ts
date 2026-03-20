import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { IMap } from "@map-migration/map-engine";
import { computed, shallowRef } from "vue";
import { FIBER_MIN_ZOOM, fiberLayerId } from "@/features/app/core/app-shell.constants";
import {
  initialFiberSourceLayerOptionsState,
  initialFiberSourceLayerSelectionState,
  initialFiberVisibilityState,
} from "@/features/app/core/app-shell.defaults";
import type {
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
  FiberVisibilityState,
} from "@/features/app/core/app-shell.types";
import {
  areAllFiberSourceLayersSelected,
  filterFiberSourceLayerOptionsByInView,
  nextSelectedFiberLayerNamesForToggle,
  normalizeSelectedFiberLayerNamesForOptions,
  selectedFiberLayerNamesForLine,
  selectedFiberSourceLayers,
} from "@/features/app/fiber/app-shell-fiber.service";
import type { UseAppShellFiberOptions } from "@/features/app/fiber/use-app-shell-fiber.types";
import {
  fetchFiberLocatorCatalog,
  fetchFiberLocatorLayersInView,
} from "@/features/fiber-locator/api";
import { mountFiberLocatorLayer } from "@/features/fiber-locator/fiber-locator.layer";
import {
  formatFiberLocatorStatus,
  getFiberLocatorSourceLayerOptions,
  initialFiberLocatorStatus,
} from "@/features/fiber-locator/fiber-locator.service";
import type {
  FiberLocatorLayerController,
  FiberLocatorLineId,
  FiberLocatorSourceLayerOption,
  FiberLocatorStatus,
} from "@/features/fiber-locator/fiber-locator.types";
import { mountFiberLocatorHover } from "@/features/fiber-locator/hover";
import type {
  FiberLocatorHoverController,
  FiberLocatorHoverState,
} from "@/features/fiber-locator/hover.types";

export function useAppShellFiber(options: UseAppShellFiberOptions) {
  const fiberControllers = shallowRef<readonly FiberLocatorLayerController[]>([]);
  const fiberHoverController = shallowRef<FiberLocatorHoverController | null>(null);
  const hoveredFiber = shallowRef<FiberLocatorHoverState | null>(null);
  const fiberStatus = shallowRef<FiberLocatorStatus>(initialFiberLocatorStatus());
  const fiberCatalogSourceLayerOptions = shallowRef<FiberSourceLayerOptionsState>(
    initialFiberSourceLayerOptionsState()
  );
  const fiberSourceLayerOptions = shallowRef<FiberSourceLayerOptionsState>(
    initialFiberSourceLayerOptionsState()
  );
  const selectedFiberSourceLayerNames = shallowRef<FiberSourceLayerSelectionState>(
    initialFiberSourceLayerSelectionState()
  );
  const pendingSelectedFiberSourceLayerNames = shallowRef<FiberSourceLayerSelectionState | null>(
    null
  );
  const hasInitializedFiberSourceLayerSelection = shallowRef<boolean>(false);
  const fiberInViewAbortController = shallowRef<AbortController | null>(null);
  const fiberInViewRequestVersion = shallowRef<number>(0);
  const fiberMoveEndHandler = shallowRef<(() => void) | null>(null);
  const visibleFiberLayers = shallowRef<FiberVisibilityState>(initialFiberVisibilityState());

  const fiberStatusText = computed(() => formatFiberLocatorStatus(fiberStatus.value));

  function hasVisibleFiberLayers(): boolean {
    return visibleFiberLayers.value.metro || visibleFiberLayers.value.longhaul;
  }

  function setSelectedFiberLayerNames(
    lineId: FiberLocatorLineId,
    selectedLayerNames: readonly string[]
  ): void {
    selectedFiberSourceLayerNames.value = {
      ...selectedFiberSourceLayerNames.value,
      [lineId]: selectedLayerNames,
    };
  }

  function setPendingFiberSourceLayerSelection(
    lineId: FiberLocatorLineId,
    selectedLayerNames: readonly string[]
  ): void {
    pendingSelectedFiberSourceLayerNames.value = {
      ...(pendingSelectedFiberSourceLayerNames.value ?? selectedFiberSourceLayerNames.value),
      [lineId]: [...selectedLayerNames],
    };
  }

  function syncFiberControllerSourceLayers(lineId: FiberLocatorLineId): void {
    const selectedSourceLayers = selectedFiberSourceLayers(
      fiberSourceLayerOptions.value[lineId],
      selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, lineId)
    );

    fiberControllers.value.reduce((_, controller) => {
      if (controller.lineId === lineId) {
        controller.setSourceLayers(selectedSourceLayers);
      }
      return 0;
    }, 0);
  }

  function clearFiberHover(): void {
    fiberHoverController.value?.clear();
    hoveredFiber.value = null;
  }

  function applyFiberSourceLayerOptions(nextOptions: FiberSourceLayerOptionsState): void {
    const pendingSelection = pendingSelectedFiberSourceLayerNames.value;
    const shouldAutoSelectAllMetro =
      !hasInitializedFiberSourceLayerSelection.value ||
      areAllFiberSourceLayersSelected(
        fiberSourceLayerOptions.value.metro,
        selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, "metro")
      );
    const shouldAutoSelectAllLonghaul =
      !hasInitializedFiberSourceLayerSelection.value ||
      areAllFiberSourceLayersSelected(
        fiberSourceLayerOptions.value.longhaul,
        selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, "longhaul")
      );

    let nextSelectedMetroLayerNames: readonly string[];
    if (pendingSelection !== null) {
      nextSelectedMetroLayerNames = normalizeSelectedFiberLayerNamesForOptions(
        nextOptions.metro,
        pendingSelection.metro
      );
    } else if (shouldAutoSelectAllMetro) {
      nextSelectedMetroLayerNames = nextOptions.metro.map((option) => option.layerName);
    } else {
      nextSelectedMetroLayerNames = normalizeSelectedFiberLayerNamesForOptions(
        nextOptions.metro,
        selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, "metro")
      );
    }

    let nextSelectedLonghaulLayerNames: readonly string[];
    if (pendingSelection !== null) {
      nextSelectedLonghaulLayerNames = normalizeSelectedFiberLayerNamesForOptions(
        nextOptions.longhaul,
        pendingSelection.longhaul
      );
    } else if (shouldAutoSelectAllLonghaul) {
      nextSelectedLonghaulLayerNames = nextOptions.longhaul.map((option) => option.layerName);
    } else {
      nextSelectedLonghaulLayerNames = normalizeSelectedFiberLayerNamesForOptions(
        nextOptions.longhaul,
        selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, "longhaul")
      );
    }

    fiberSourceLayerOptions.value = nextOptions;
    selectedFiberSourceLayerNames.value = {
      metro: nextSelectedMetroLayerNames,
      longhaul: nextSelectedLonghaulLayerNames,
    };
    pendingSelectedFiberSourceLayerNames.value = null;
    hasInitializedFiberSourceLayerSelection.value = true;

    syncFiberControllerSourceLayers("metro");
    syncFiberControllerSourceLayers("longhaul");
    clearFiberHover();
  }

  async function refreshFiberLocatorLayersInView(): Promise<void> {
    const currentMap = options.map.value;
    if (currentMap === null || !hasVisibleFiberLayers()) {
      return;
    }

    if (currentMap.getZoom() < FIBER_MIN_ZOOM) {
      return;
    }

    const allOptions = fiberCatalogSourceLayerOptions.value;
    if (allOptions.metro.length === 0 && allOptions.longhaul.length === 0) {
      return;
    }

    fiberInViewAbortController.value?.abort();
    const abortController = new AbortController();
    fiberInViewAbortController.value = abortController;

    fiberInViewRequestVersion.value += 1;
    const requestVersion = fiberInViewRequestVersion.value;

    const bounds = currentMap.getBounds();
    const bbox: BBox = {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    };

    const result = await fetchFiberLocatorLayersInView(bbox, {
      signal: abortController.signal,
    });

    if (requestVersion !== fiberInViewRequestVersion.value) {
      return;
    }

    if (!result.ok) {
      if (result.reason !== "aborted") {
        console.error("Fiber locator layers/inview failed", result);
      }
      return;
    }

    applyFiberSourceLayerOptions(
      filterFiberSourceLayerOptionsByInView(allOptions, result.data.layers)
    );
  }

  async function loadFiberLocatorCatalogStatus(): Promise<void> {
    fiberStatus.value = {
      state: "loading",
    };

    const result = await fetchFiberLocatorCatalog();
    if (!result.ok) {
      fiberStatus.value = {
        state: "error",
        requestId: result.requestId,
        reason: result.reason,
      };
      return;
    }

    fiberStatus.value = {
      state: "ok",
      requestId: result.requestId,
      count: result.data.meta.recordCount,
    };

    fiberCatalogSourceLayerOptions.value = {
      metro: getFiberLocatorSourceLayerOptions(result.data.layers, "metro"),
      longhaul: getFiberLocatorSourceLayerOptions(result.data.layers, "longhaul"),
    };

    if (hasVisibleFiberLayers()) {
      await refreshFiberLocatorLayersInView();
    } else {
      applyFiberSourceLayerOptions(fiberCatalogSourceLayerOptions.value);
    }
  }

  function setFiberLayerVisibility(lineId: FiberLocatorLineId, visible: boolean): void {
    visibleFiberLayers.value = {
      ...visibleFiberLayers.value,
      [lineId]: visible,
    };

    options.layerRuntime.value?.setUserVisible(fiberLayerId(lineId), visible);

    if (visible) {
      setAllFiberSourceLayers(lineId, true);
      refreshFiberLocatorLayersInView().catch((error: unknown) => {
        console.error("Fiber locator layers/inview refresh failed", error);
      });
    } else if (!hasVisibleFiberLayers()) {
      fiberInViewAbortController.value?.abort();
      fiberInViewAbortController.value = null;
    }

    clearFiberHover();
  }

  function setAllFiberSourceLayers(lineId: FiberLocatorLineId, visible: boolean): void {
    const optionsForLine = fiberSourceLayerOptions.value[lineId];
    const nextSelectedLayerNames = visible ? optionsForLine.map((option) => option.layerName) : [];

    setSelectedFiberLayerNames(lineId, nextSelectedLayerNames);
    setPendingFiberSourceLayerSelection(lineId, nextSelectedLayerNames);
    syncFiberControllerSourceLayers(lineId);
    clearFiberHover();
  }

  function setFiberSourceLayerSelection(
    lineId: FiberLocatorLineId,
    selectedLayerNames: readonly string[]
  ): void {
    const normalizedSelection =
      fiberSourceLayerOptions.value[lineId].length === 0
        ? [...selectedLayerNames]
        : normalizeSelectedFiberLayerNamesForOptions(
            fiberSourceLayerOptions.value[lineId],
            selectedLayerNames
          );

    setSelectedFiberLayerNames(lineId, normalizedSelection);
    setPendingFiberSourceLayerSelection(lineId, normalizedSelection);
    hasInitializedFiberSourceLayerSelection.value = true;

    if (fiberSourceLayerOptions.value[lineId].length > 0) {
      syncFiberControllerSourceLayers(lineId);
    }

    clearFiberHover();
  }

  function setFiberSourceLayerVisible(
    lineId: FiberLocatorLineId,
    layerName: string,
    visible: boolean
  ): void {
    const normalizedLayerName = layerName.trim().toLowerCase();
    if (normalizedLayerName.length === 0) {
      return;
    }

    const optionsForLine = fiberSourceLayerOptions.value[lineId];
    const isKnownSourceLayer = optionsForLine.some(
      (option) => option.layerName.toLowerCase() === normalizedLayerName
    );
    if (!isKnownSourceLayer) {
      return;
    }

    setSelectedFiberLayerNames(
      lineId,
      nextSelectedFiberLayerNamesForToggle(
        optionsForLine,
        selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, lineId),
        normalizedLayerName,
        visible
      )
    );
    setPendingFiberSourceLayerSelection(
      lineId,
      selectedFiberLayerNamesForLine(selectedFiberSourceLayerNames.value, lineId)
    );
    syncFiberControllerSourceLayers(lineId);
    clearFiberHover();
  }

  function mountFiberLayer(
    nextMap: IMap,
    nextControllers: FiberLocatorLayerController[],
    lineId: FiberLocatorLineId,
    sourceLayers: readonly FiberLocatorSourceLayerOption[]
  ): void {
    const controller = mountFiberLocatorLayer({
      map: nextMap,
      lineId,
      sourceLayers,
    });

    options.layerRuntime.value?.registerLayerController(fiberLayerId(lineId), controller);
    nextControllers.push(controller);
  }

  function initialize(nextMap: IMap): void {
    const nextFiberControllers: FiberLocatorLayerController[] = [];
    mountFiberLayer(nextMap, nextFiberControllers, "metro", []);
    mountFiberLayer(nextMap, nextFiberControllers, "longhaul", []);
    fiberControllers.value = nextFiberControllers;

    visibleFiberLayers.value = {
      metro: options.layerRuntime.value?.getUserVisible(fiberLayerId("metro")) ?? false,
      longhaul: options.layerRuntime.value?.getUserVisible(fiberLayerId("longhaul")) ?? false,
    };

    const onFiberMoveEnd = (): void => {
      refreshFiberLocatorLayersInView().catch((error: unknown) => {
        console.error("Fiber locator layers/inview refresh failed", error);
      });
    };

    fiberMoveEndHandler.value = onFiberMoveEnd;
    nextMap.on("load", onFiberMoveEnd);
    nextMap.on("moveend", onFiberMoveEnd);

    loadFiberLocatorCatalogStatus().catch((error: unknown) => {
      console.error("Fiber locator catalog status failed", error);
    });

    fiberHoverController.value = mountFiberLocatorHover(nextMap, {
      getControllers: () => fiberControllers.value,
      getSourceLayerOptions: (lineId) => fiberSourceLayerOptions.value[lineId],
      isInteractionEnabled: options.isInteractionEnabled,
      onHoverChange: (nextHover) => {
        hoveredFiber.value = nextHover;
      },
    });
  }

  function destroy(currentMap: IMap | null): void {
    fiberInViewAbortController.value?.abort();
    fiberInViewAbortController.value = null;

    fiberHoverController.value?.destroy();
    fiberHoverController.value = null;

    fiberControllers.value.reduce((_, controller) => {
      controller.destroy();
      return 0;
    }, 0);
    fiberControllers.value = [];

    if (currentMap !== null && fiberMoveEndHandler.value !== null) {
      currentMap.off("load", fiberMoveEndHandler.value);
      currentMap.off("moveend", fiberMoveEndHandler.value);
    }

    fiberMoveEndHandler.value = null;
  }

  return {
    hoveredFiber,
    fiberStatusText,
    fiberSourceLayerOptions,
    selectedFiberSourceLayerNames,
    visibleFiberLayers,
    setFiberLayerVisibility,
    setFiberSourceLayerSelection,
    setFiberSourceLayerVisible,
    setAllFiberSourceLayers,
    clearFiberHover,
    initialize,
    destroy,
  };
}
