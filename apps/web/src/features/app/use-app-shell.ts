import type { FacilityPerspective } from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import type { IControl } from "maplibre-gl";
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
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
import { mountFacilitiesLayer } from "@/features/facilities/facilities.layer";
import { formatFacilitiesStatus } from "@/features/facilities/facilities.service";
import type {
  FacilitiesLayerController,
  FacilitiesStatus,
  SelectedFacilityRef,
} from "@/features/facilities/facilities.types";
import { useFacilityDetailQuery } from "@/features/facilities/facility-detail/detail";
import { mountFacilitiesHover } from "@/features/facilities/hover";
import type {
  FacilitiesHoverController,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import { createLayerRuntime } from "@/features/layers/layer-runtime.service";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";
import { mountMeasureLayer } from "@/features/measure/measure.layer";
import type {
  MeasureAreaShape,
  MeasureLayerController,
  MeasureMode,
  MeasureState,
} from "@/features/measure/measure.types";
import { useParcelDetailQuery } from "@/features/parcels/parcel-detail/detail";
import { mountParcelsLayer } from "@/features/parcels/parcels.layer";
import { formatParcelsStatus } from "@/features/parcels/parcels.service";
import type {
  ParcelsLayerController,
  ParcelsStatus,
  SelectedParcelRef,
} from "@/features/parcels/parcels.types";
import { mountPowerLayerVisibility } from "@/features/power/power.layer";
import { powerLayerIds } from "@/features/power/power.service";
import type {
  PowerLayerId,
  PowerLayerVisibilityController,
  PowerVisibilityState,
} from "@/features/power/power.types";
import { mountPowerHover } from "@/features/power/power-hover";
import type { PowerHoverController, PowerHoverState } from "@/features/power/power-hover.types";
import { facilitiesLayerId, PARCELS_LAYER_ID, powerLayerId } from "./app-shell.constants";
import {
  initialBoundaryFacetOptionsState,
  initialBoundaryFacetSelectionState,
  initialBoundaryVisibilityState,
  initialMeasureState,
  initialParcelsStatus,
  initialPerspectiveStatusState,
  initialPerspectiveVisibilityState,
  initialPowerVisibilityState,
  isSamePerspective,
} from "./app-shell.defaults";
import { initializeAppShellMap, suppressMapLibreGlyphWarnings } from "./app-shell.map.service";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "./app-shell.types";
import { useAppShellFiber } from "./use-app-shell-fiber";

interface BoundaryHoverByLayerState {
  readonly country: BoundaryHoverState | null;
  readonly county: BoundaryHoverState | null;
  readonly state: BoundaryHoverState | null;
}

interface BoundaryControllerState {
  readonly country: BoundaryLayerController | null;
  readonly county: BoundaryLayerController | null;
  readonly state: BoundaryLayerController | null;
}

function initialBoundaryControllerState(): BoundaryControllerState {
  return {
    county: null,
    state: null,
    country: null,
  };
}

function withBoundaryController(
  state: BoundaryControllerState,
  boundaryId: BoundaryLayerId,
  controller: BoundaryLayerController | null
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

function initialBoundaryHoverByLayerState(): BoundaryHoverByLayerState {
  return {
    county: null,
    state: null,
    country: null,
  };
}

function resolveBoundaryHoverState(
  hoverByLayer: BoundaryHoverByLayerState
): BoundaryHoverState | null {
  return hoverByLayer.county ?? hoverByLayer.state ?? hoverByLayer.country;
}

export function useAppShell() {
  const mapContainer = useTemplateRef<HTMLDivElement>("map-container");
  const map = shallowRef<IMap | null>(null);
  const selectedFacility = shallowRef<SelectedFacilityRef | null>(null);
  const selectedParcel = shallowRef<SelectedParcelRef | null>(null);
  const hoveredFacility = shallowRef<FacilityHoverState | null>(null);
  const hoveredBoundary = shallowRef<BoundaryHoverState | null>(null);
  const boundaryHoverByLayer = shallowRef<BoundaryHoverByLayerState>(
    initialBoundaryHoverByLayerState()
  );
  const hoveredPower = shallowRef<PowerHoverState | null>(null);
  const boundaryControllers = shallowRef<BoundaryControllerState>(initialBoundaryControllerState());
  const facilitiesControllers = shallowRef<readonly FacilitiesLayerController[]>([]);
  const powerControllers = shallowRef<readonly PowerLayerVisibilityController[]>([]);
  const parcelsController = shallowRef<ParcelsLayerController | null>(null);
  const layerRuntime = shallowRef<LayerRuntimeController | null>(null);
  const facilitiesHoverController = shallowRef<FacilitiesHoverController | null>(null);
  const powerHoverController = shallowRef<PowerHoverController | null>(null);
  const measureController = shallowRef<MeasureLayerController | null>(null);
  const disposeBasemapEnhancements = shallowRef<(() => void) | null>(null);
  const disposePmtilesProtocol = shallowRef<(() => void) | null>(null);
  const restoreConsoleWarn = shallowRef<(() => void) | null>(null);
  const mapControls = shallowRef<readonly IControl[]>([]);
  const facilitiesStatus = shallowRef<PerspectiveStatusState>(initialPerspectiveStatusState());
  const parcelsStatus = shallowRef<ParcelsStatus>(initialParcelsStatus());
  const parcelsVisible = shallowRef<boolean>(false);
  const powerVisibility = shallowRef<PowerVisibilityState>(initialPowerVisibilityState());
  const boundaryFacetOptions = shallowRef<BoundaryFacetOptionsState>(
    initialBoundaryFacetOptionsState()
  );
  const boundaryFacetSelection = shallowRef<BoundaryFacetSelectionState>(
    initialBoundaryFacetSelectionState()
  );
  const boundaryVisibility = shallowRef<BoundaryVisibilityState>(initialBoundaryVisibilityState());
  const visiblePerspectives = shallowRef<PerspectiveVisibilityState>(
    initialPerspectiveVisibilityState()
  );
  const measureState = shallowRef<MeasureState>(initialMeasureState());
  const isLayerPanelOpen = shallowRef<boolean>(true);
  const isMeasurePanelOpen = shallowRef<boolean>(true);

  const areFacilityInteractionsEnabled = computed(() => measureState.value.mode === "off");
  const colocationStatusText = computed(() =>
    formatFacilitiesStatus(facilitiesStatus.value.colocation)
  );
  const hyperscaleStatusText = computed(() =>
    formatFacilitiesStatus(facilitiesStatus.value.hyperscale)
  );
  const parcelsStatusText = computed(() => formatParcelsStatus(parcelsStatus.value));

  const facilityDetailQuery = useFacilityDetailQuery(selectedFacility);
  const parcelDetailQuery = useParcelDetailQuery(selectedParcel);

  const fiber = useAppShellFiber({
    map,
    layerRuntime,
    isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
  });

  function clearSelectedFacility(): void {
    facilitiesControllers.value.reduce((_, controller) => {
      controller.clearSelection();
      return 0;
    }, 0);
    selectedFacility.value = null;
  }

  function clearSelectedParcel(): void {
    parcelsController.value?.clearSelection();
    selectedParcel.value = null;
  }

  function setPerspectiveStatus(perspective: FacilityPerspective, status: FacilitiesStatus): void {
    facilitiesStatus.value = {
      ...facilitiesStatus.value,
      [perspective]: status,
    };
  }

  function setParcelsStatus(status: ParcelsStatus): void {
    parcelsStatus.value = status;
  }

  function setPerspectiveVisibility(perspective: FacilityPerspective, visible: boolean): void {
    visiblePerspectives.value = {
      ...visiblePerspectives.value,
      [perspective]: visible,
    };

    layerRuntime.value?.setUserVisible(facilitiesLayerId(perspective), visible);
  }

  function setParcelsVisible(visible: boolean): void {
    parcelsVisible.value = visible;
    layerRuntime.value?.setUserVisible(PARCELS_LAYER_ID, visible);

    if (!visible) {
      clearSelectedParcel();
    }
  }

  function setPowerLayerVisible(layerId: PowerLayerId, visible: boolean): void {
    powerVisibility.value = {
      ...powerVisibility.value,
      [layerId]: visible,
    };

    layerRuntime.value?.setUserVisible(powerLayerId(layerId), visible);
    powerHoverController.value?.clear();
    hoveredPower.value = null;
  }

  function setBoundaryVisible(boundaryId: BoundaryLayerId, visible: boolean): void {
    boundaryVisibility.value = {
      ...boundaryVisibility.value,
      [boundaryId]: visible,
    };

    if (visible) {
      boundaryFacetSelection.value = {
        ...boundaryFacetSelection.value,
        [boundaryId]: null,
      };
      boundaryControllerForId(boundaryId)?.setIncludedRegionIds(null);
    }

    layerRuntime.value?.setUserVisible(boundaryId, visible);
  }

  function boundaryControllerForId(boundaryId: BoundaryLayerId): BoundaryLayerController | null {
    return boundaryControllers.value[boundaryId];
  }

  function setBoundaryHoverState(
    boundaryId: BoundaryLayerId,
    nextHover: BoundaryHoverState | null
  ): void {
    const previousState = boundaryHoverByLayer.value;

    if (boundaryId === "county") {
      boundaryHoverByLayer.value = {
        county: nextHover,
        state: previousState.state,
        country: previousState.country,
      };
    } else if (boundaryId === "state") {
      boundaryHoverByLayer.value = {
        county: previousState.county,
        state: nextHover,
        country: previousState.country,
      };
    } else {
      boundaryHoverByLayer.value = {
        county: previousState.county,
        state: previousState.state,
        country: nextHover,
      };
    }

    hoveredBoundary.value = resolveBoundaryHoverState(boundaryHoverByLayer.value);
  }

  function setBoundaryFacetOptions(
    boundaryId: BoundaryLayerId,
    options: readonly BoundaryFacetOption[]
  ): void {
    boundaryFacetOptions.value = {
      ...boundaryFacetOptions.value,
      [boundaryId]: options,
    };

    const currentSelection = boundaryFacetSelection.value[boundaryId];
    if (currentSelection === null) {
      return;
    }

    const normalizedSelection = reconcileBoundaryFacetSelection(options, currentSelection);
    boundaryFacetSelection.value = {
      ...boundaryFacetSelection.value,
      [boundaryId]: normalizedSelection,
    };
    boundaryControllerForId(boundaryId)?.setIncludedRegionIds(normalizedSelection);
  }

  function setBoundarySelectedRegionIds(
    boundaryId: BoundaryLayerId,
    selectedRegionIds: readonly string[] | null
  ): void {
    const normalizedRegionIds = normalizeBoundaryRegionIds(selectedRegionIds);
    boundaryFacetSelection.value = {
      ...boundaryFacetSelection.value,
      [boundaryId]: normalizedRegionIds,
    };
    boundaryControllerForId(boundaryId)?.setIncludedRegionIds(normalizedRegionIds);
  }

  function mountPerspectiveLayer(
    nextMap: IMap,
    nextControllers: FacilitiesLayerController[],
    perspective: FacilityPerspective
  ): void {
    const controller = mountFacilitiesLayer(nextMap, {
      perspective,
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onStatus: (status) => {
        setPerspectiveStatus(perspective, status);
      },
      onSelectFacility: (facility) => {
        if (facility === null) {
          if (isSamePerspective(selectedFacility.value, perspective)) {
            selectedFacility.value = null;
          }
          return;
        }

        selectedFacility.value = facility;
        nextControllers.reduce((_, existingController) => {
          if (existingController !== controller) {
            existingController.clearSelection();
          }
          return 0;
        }, 0);
      },
    });

    layerRuntime.value?.registerLayerController(facilitiesLayerId(perspective), controller);
    nextControllers.push(controller);
  }

  function setMeasureMode(mode: MeasureMode): void {
    measureController.value?.setMode(mode);
  }

  function setMeasureAreaShape(shape: MeasureAreaShape): void {
    measureController.value?.setAreaShape(shape);
  }

  function finishMeasureSelection(): void {
    measureController.value?.finishSelection();
  }

  function clearMeasure(): void {
    measureController.value?.clear();
  }

  function toggleLayerPanel(): void {
    isLayerPanelOpen.value = !isLayerPanelOpen.value;
  }

  function toggleMeasurePanel(): void {
    isMeasurePanelOpen.value = !isMeasurePanelOpen.value;
  }

  function initializeMap(): void {
    const container = mapContainer.value;
    if (container === null) {
      return;
    }

    const mapSetup = initializeAppShellMap(container);
    disposePmtilesProtocol.value = mapSetup.disposePmtilesProtocol;
    map.value = mapSetup.map;
    layerRuntime.value = createLayerRuntime(mapSetup.map);
    disposeBasemapEnhancements.value = mapSetup.disposeBasemapEnhancements;
    mapControls.value = mapSetup.controls;

    const nextBoundaryControllers = boundaryLayerIds().reduce<BoundaryControllerState>(
      (controllers, boundaryId) => {
        const controller = mountBoundaryLayer(mapSetup.map, {
          layerId: boundaryId,
          isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
          onFacetOptionsChange: setBoundaryFacetOptions,
          onHoverChange: (nextHover) => {
            setBoundaryHoverState(boundaryId, nextHover);
          },
        });
        controller.setIncludedRegionIds(boundaryFacetSelection.value[boundaryId]);
        layerRuntime.value?.registerLayerController(boundaryId, controller);
        return withBoundaryController(controllers, boundaryId, controller);
      },
      initialBoundaryControllerState()
    );
    boundaryControllers.value = nextBoundaryControllers;
    const runtime = layerRuntime.value;
    boundaryVisibility.value = {
      county: runtime?.getUserVisible("county") ?? boundaryVisibility.value.county,
      state: runtime?.getUserVisible("state") ?? boundaryVisibility.value.state,
      country: runtime?.getUserVisible("country") ?? boundaryVisibility.value.country,
    };

    const nextFacilitiesControllers: FacilitiesLayerController[] = [];
    mountPerspectiveLayer(mapSetup.map, nextFacilitiesControllers, "colocation");
    mountPerspectiveLayer(mapSetup.map, nextFacilitiesControllers, "hyperscale");
    facilitiesControllers.value = nextFacilitiesControllers;

    parcelsController.value = mountParcelsLayer(mapSetup.map, {
      disableGuardrails: true,
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onSelectParcel: (parcel) => {
        selectedParcel.value = parcel;
        if (parcel !== null) {
          clearSelectedFacility();
        }
      },
      onStatus: (status) => {
        setParcelsStatus(status);
      },
      onStressBlockedChange: (blocked) => {
        layerRuntime.value?.setStressBlocked(PARCELS_LAYER_ID, blocked);
      },
    });

    if (parcelsController.value !== null) {
      layerRuntime.value?.registerLayerController(PARCELS_LAYER_ID, parcelsController.value);
    }
    parcelsVisible.value = layerRuntime.value?.getUserVisible(PARCELS_LAYER_ID) ?? false;

    fiber.initialize(mapSetup.map);

    const nextPowerControllers = powerLayerIds().reduce<PowerLayerVisibilityController[]>(
      (controllers, layerId) => {
        const controller = mountPowerLayerVisibility({
          map: mapSetup.map,
          layerId,
          styleLayerId: powerLayerId(layerId),
        });

        layerRuntime.value?.registerLayerController(powerLayerId(layerId), controller);
        controllers.push(controller);
        return controllers;
      },
      []
    );
    powerControllers.value = nextPowerControllers;

    const powerRuntime = layerRuntime.value;
    if (powerRuntime !== null) {
      powerRuntime.setUserVisible(powerLayerId("transmission"), powerVisibility.value.transmission);
      powerRuntime.setUserVisible(powerLayerId("substations"), powerVisibility.value.substations);
      powerRuntime.setUserVisible(powerLayerId("plants"), powerVisibility.value.plants);
    }

    powerVisibility.value = {
      transmission:
        powerRuntime?.getUserVisible(powerLayerId("transmission")) ??
        powerVisibility.value.transmission,
      substations:
        powerRuntime?.getUserVisible(powerLayerId("substations")) ??
        powerVisibility.value.substations,
      plants: powerRuntime?.getUserVisible(powerLayerId("plants")) ?? powerVisibility.value.plants,
    };

    powerHoverController.value = mountPowerHover(mapSetup.map, {
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onHoverChange: (nextHover) => {
        hoveredPower.value = nextHover;
      },
    });

    facilitiesHoverController.value = mountFacilitiesHover(mapSetup.map, {
      perspectives: ["colocation", "hyperscale"],
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onHoverChange: (nextHover) => {
        hoveredFacility.value = nextHover;
      },
    });

    measureController.value = mountMeasureLayer(mapSetup.map, {
      onStateChange: (nextState) => {
        measureState.value = nextState;
      },
    });
  }

  watch(
    () => measureState.value.mode,
    (mode) => {
      if (mode === "off") {
        return;
      }

      clearSelectedFacility();
      clearSelectedParcel();
      facilitiesHoverController.value?.clear();
      hoveredFacility.value = null;
      boundaryLayerIds().reduce((_, boundaryId) => {
        boundaryControllers.value[boundaryId]?.clearHover();
        return 0;
      }, 0);
      boundaryHoverByLayer.value = initialBoundaryHoverByLayerState();
      hoveredBoundary.value = null;
      powerHoverController.value?.clear();
      hoveredPower.value = null;
      fiber.clearFiberHover();
    }
  );

  onMounted(() => {
    try {
      restoreConsoleWarn.value = suppressMapLibreGlyphWarnings();
      initializeMap();
    } catch (error: unknown) {
      console.error("Map initialization failed", error);
    }
  });

  onBeforeUnmount(() => {
    disposeBasemapEnhancements.value?.();
    disposeBasemapEnhancements.value = null;

    facilitiesHoverController.value?.destroy();
    facilitiesHoverController.value = null;
    hoveredFacility.value = null;

    powerHoverController.value?.destroy();
    powerHoverController.value = null;
    hoveredPower.value = null;

    measureController.value?.destroy();
    measureController.value = null;

    boundaryLayerIds().reduce((_, boundaryId) => {
      boundaryControllers.value[boundaryId]?.destroy();
      return 0;
    }, 0);
    boundaryControllers.value = initialBoundaryControllerState();
    boundaryFacetOptions.value = initialBoundaryFacetOptionsState();
    boundaryFacetSelection.value = initialBoundaryFacetSelectionState();
    boundaryHoverByLayer.value = initialBoundaryHoverByLayerState();
    hoveredBoundary.value = null;

    parcelsController.value?.destroy();
    parcelsController.value = null;

    const currentMap = map.value;
    fiber.destroy(currentMap);

    powerControllers.value.reduce((_, controller) => {
      controller.destroy();
      return 0;
    }, 0);
    powerControllers.value = [];

    facilitiesControllers.value.reduce((_, controller) => {
      controller.destroy();
      return 0;
    }, 0);
    facilitiesControllers.value = [];

    layerRuntime.value?.destroy();
    layerRuntime.value = null;

    if (currentMap !== null) {
      mapControls.value.reduce((_, control) => {
        currentMap.removeControl(control);
        return 0;
      }, 0);
    }

    mapControls.value = [];
    currentMap?.destroy();
    map.value = null;

    disposePmtilesProtocol.value?.();
    disposePmtilesProtocol.value = null;

    restoreConsoleWarn.value?.();
    restoreConsoleWarn.value = null;
  });

  return {
    mapContainer,
    selectedFacility,
    selectedParcel,
    hoveredFacility,
    hoveredBoundary,
    hoveredFiber: fiber.hoveredFiber,
    hoveredPower,
    boundaryVisibility,
    boundaryFacetOptions,
    boundaryFacetSelection,
    visiblePerspectives,
    colocationStatusText,
    hyperscaleStatusText,
    parcelsVisible,
    parcelsStatusText,
    powerVisibility,
    visibleFiberLayers: fiber.visibleFiberLayers,
    fiberStatusText: fiber.fiberStatusText,
    fiberSourceLayerOptions: fiber.fiberSourceLayerOptions,
    selectedFiberSourceLayerNames: fiber.selectedFiberSourceLayerNames,
    measureState,
    isLayerPanelOpen,
    isMeasurePanelOpen,
    facilityDetailQuery,
    parcelDetailQuery,
    setPerspectiveVisibility,
    setBoundaryVisible,
    setBoundarySelectedRegionIds,
    setParcelsVisible,
    setPowerLayerVisible,
    setFiberLayerVisibility: fiber.setFiberLayerVisibility,
    setFiberSourceLayerVisible: fiber.setFiberSourceLayerVisible,
    setAllFiberSourceLayers: fiber.setAllFiberSourceLayers,
    setMeasureMode,
    setMeasureAreaShape,
    finishMeasureSelection,
    clearMeasure,
    clearSelectedFacility,
    clearSelectedParcel,
    toggleLayerPanel,
    toggleMeasurePanel,
  };
}
