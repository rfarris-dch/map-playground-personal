import type { FacilitiesFeatureCollection, FacilityPerspective } from "@map-migration/contracts";
import type { IMap, MapControl } from "@map-migration/map-engine";
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import {
  facilitiesLayerId,
  PARCELS_LAYER_ID,
  powerLayerId,
} from "@/features/app/app-shell.constants";
import {
  initialBasemapVisibilityState,
  initialBoundaryFacetOptionsState,
  initialBoundaryFacetSelectionState,
  initialBoundaryVisibilityState,
  initialMeasureState,
  initialParcelsStatus,
  initialPerspectiveStatusState,
  initialPerspectiveVisibilityState,
  initialPowerVisibilityState,
  isSamePerspective,
} from "@/features/app/app-shell.defaults";
import {
  initializeAppShellMap,
  suppressMapLibreGlyphWarnings,
} from "@/features/app/app-shell.map.service";
import type {
  BoundaryFacetOptionsState,
  BoundaryFacetSelectionState,
  BoundaryVisibilityState,
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/app-shell.types";
import {
  initialBoundaryControllerState,
  initialBoundaryHoverByLayerState,
  resolveBoundaryHoverState,
  withBoundaryController,
} from "@/features/app/app-shell-boundary.service";
import type {
  BoundaryControllerState,
  BoundaryHoverByLayerState,
} from "@/features/app/app-shell-boundary.types";
import { resolveDisableParcelsGuardrails } from "@/features/app/app-shell-runtime.service";
import {
  buildEmptyMeasureSelectionSummary,
  queryMeasureSelectionSummary,
} from "@/features/app/measure-selection.service";
import { useAppShellFiber } from "@/features/app/use-app-shell-fiber";
import { useMapOverlays } from "@/features/app/use-map-overlays";
import { basemapLayerIds } from "@/features/basemap/basemap.service";
import type {
  BasemapLayerId,
  BasemapLayerVisibilityController,
  BasemapVisibilityState,
} from "@/features/basemap/basemap.types";
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
import { buildMeasureSelectionCsv } from "@/features/measure/measure-analysis.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
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

const FACILITIES_LAYER_MIN_ZOOM = 3.5;
const FACILITIES_LAYER_LIMIT = 1000;
const FACILITIES_LAYER_DEBOUNCE_MS = 350;

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
  const basemapLayerController = shallowRef<BasemapLayerVisibilityController | null>(null);
  const disposePmtilesProtocol = shallowRef<(() => void) | null>(null);
  const restoreConsoleWarn = shallowRef<(() => void) | null>(null);
  const mapControls = shallowRef<readonly MapControl[]>([]);
  const basemapVisibility = shallowRef<BasemapVisibilityState>(initialBasemapVisibilityState());
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
  const measureSelectionSummary = shallowRef<MeasureSelectionSummary | null>(null);
  const measureSelectionError = shallowRef<string | null>(null);
  const isMeasureSelectionLoading = shallowRef<boolean>(false);
  const colocationViewportFeatures = shallowRef<FacilitiesFeatureCollection["features"]>([]);
  const hyperscaleViewportFeatures = shallowRef<FacilitiesFeatureCollection["features"]>([]);
  let measureSelectionAbortController: AbortController | null = null;
  let measureSelectionRequestSequence = 0;
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
  const mapOverlays = useMapOverlays({
    map,
    measureState,
    visiblePerspectives,
    colocationViewportFeatures,
    hyperscaleViewportFeatures,
    clearMeasure,
    finishMeasureSelection,
    setMeasureMode,
  });

  function clearSelectedFacility(): void {
    facilitiesControllers.value.reduce((_, controller) => {
      controller.clearSelection();
      return 0;
    }, 0);
    selectedFacility.value = null;
  }

  function selectFacilityFromAnalysis(facility: SelectedFacilityRef): void {
    facilitiesControllers.value.reduce((_, controller) => {
      controller.clearSelection();
      return 0;
    }, 0);
    selectedFacility.value = facility;
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

  function setViewportFacilities(
    perspective: FacilityPerspective,
    features: FacilitiesFeatureCollection["features"]
  ): void {
    if (perspective === "colocation") {
      colocationViewportFeatures.value = features;
      return;
    }

    hyperscaleViewportFeatures.value = features;
  }

  function setPerspectiveVisibility(perspective: FacilityPerspective, visible: boolean): void {
    visiblePerspectives.value = {
      ...visiblePerspectives.value,
      [perspective]: visible,
    };

    layerRuntime.value?.setUserVisible(facilitiesLayerId(perspective), visible);

    if (!visible) {
      setViewportFacilities(perspective, []);
    }
  }

  function setParcelsVisible(visible: boolean): void {
    parcelsVisible.value = visible;
    layerRuntime.value?.setUserVisible(PARCELS_LAYER_ID, visible);

    if (!visible) {
      clearSelectedParcel();
    }
  }

  function basemapLayerIdsVisibility(layerId: BasemapLayerId): boolean {
    if (layerId === "boundaries") {
      return basemapVisibility.value.boundaries;
    }

    if (layerId === "buildings3d") {
      return basemapVisibility.value.buildings3d;
    }

    if (layerId === "labels") {
      return basemapVisibility.value.labels;
    }

    if (layerId === "landmarks") {
      return basemapVisibility.value.landmarks;
    }

    if (layerId === "roads") {
      return basemapVisibility.value.roads;
    }

    return basemapVisibility.value.satellite;
  }

  function setBasemapLayerVisible(layerId: BasemapLayerId, visible: boolean): void {
    if (layerId === "boundaries") {
      basemapVisibility.value = {
        ...basemapVisibility.value,
        boundaries: visible,
      };
    } else if (layerId === "buildings3d") {
      basemapVisibility.value = {
        ...basemapVisibility.value,
        buildings3d: visible,
      };
    } else if (layerId === "labels") {
      basemapVisibility.value = {
        ...basemapVisibility.value,
        labels: visible,
      };
    } else if (layerId === "landmarks") {
      basemapVisibility.value = {
        ...basemapVisibility.value,
        landmarks: visible,
      };
    } else if (layerId === "roads") {
      basemapVisibility.value = {
        ...basemapVisibility.value,
        roads: visible,
      };
    } else {
      basemapVisibility.value = {
        ...basemapVisibility.value,
        satellite: visible,
      };
    }

    basemapLayerController.value?.setVisible(layerId, visible);
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
      debounceMs: FACILITIES_LAYER_DEBOUNCE_MS,
      limit: FACILITIES_LAYER_LIMIT,
      minZoom: FACILITIES_LAYER_MIN_ZOOM,
      perspective,
      isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
      onStatus: (status) => {
        setPerspectiveStatus(perspective, status);
      },
      onViewportUpdate: (snapshot) => {
        setViewportFacilities(perspective, snapshot.features);
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

  async function refreshMeasureSelectionSummary(): Promise<void> {
    const selectionRing = measureState.value.selectionRing;
    if (selectionRing === null) {
      measureSelectionAbortController?.abort();
      measureSelectionAbortController = null;
      measureSelectionRequestSequence += 1;
      isMeasureSelectionLoading.value = false;
      measureSelectionError.value = null;
      measureSelectionSummary.value = null;
      return;
    }

    measureSelectionRequestSequence += 1;
    const requestSequence = measureSelectionRequestSequence;
    measureSelectionAbortController?.abort();
    const abortController = new AbortController();
    measureSelectionAbortController = abortController;
    isMeasureSelectionLoading.value = true;
    measureSelectionError.value = null;
    measureSelectionSummary.value = buildEmptyMeasureSelectionSummary(selectionRing);

    const queryResult = await queryMeasureSelectionSummary({
      selectionRing,
      visiblePerspectives: visiblePerspectives.value,
      signal: abortController.signal,
    });

    if (requestSequence !== measureSelectionRequestSequence) {
      return;
    }

    isMeasureSelectionLoading.value = false;
    if (!queryResult.ok) {
      return;
    }

    measureSelectionError.value = queryResult.value.errorMessage;
    measureSelectionSummary.value = queryResult.value.summary;
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

  function exportMeasureSelection(): void {
    const summary = measureSelectionSummary.value;
    if (summary === null || summary.totalCount === 0) {
      return;
    }

    const csv = buildMeasureSelectionCsv(summary);
    const dateLabel = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `map-selection-${dateLabel}.csv`;
    downloadLink.click();
    URL.revokeObjectURL(url);
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
    basemapLayerController.value = mapSetup.basemapLayerController;
    mapControls.value = mapSetup.controls;

    for (const layerId of basemapLayerIds()) {
      mapSetup.basemapLayerController.setVisible(layerId, basemapLayerIdsVisibility(layerId));
    }

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
      disableGuardrails: resolveDisableParcelsGuardrails(),
      maxViewportWidthKm: 500,
      maxPredictedTiles: 500,
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

  watch(
    [
      () => measureState.value.selectionRing,
      () => visiblePerspectives.value.colocation,
      () => visiblePerspectives.value.hyperscale,
    ],
    () => {
      refreshMeasureSelectionSummary().catch((error: unknown) => {
        console.error("[map] measure selection summary refresh failed", error);
      });
    },
    { immediate: true }
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
    measureSelectionAbortController?.abort();
    measureSelectionAbortController = null;
    isMeasureSelectionLoading.value = false;
    measureSelectionError.value = null;

    basemapLayerController.value?.destroy();
    basemapLayerController.value = null;

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
    map,
    selectedFacility,
    selectedParcel,
    hoveredFacility,
    hoveredBoundary,
    hoveredFiber: fiber.hoveredFiber,
    hoveredPower,
    basemapVisibility,
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
    measureSelectionSummary,
    measureSelectionError,
    isMeasureSelectionLoading,
    quickViewActive: mapOverlays.quickViewActive,
    scannerActive: mapOverlays.scannerActive,
    scannerSummary: mapOverlays.scannerSummary,
    scannerFacilities: mapOverlays.scannerFacilities,
    scannerTotalCount: mapOverlays.scannerTotalCount,
    scannerIsFiltered: mapOverlays.scannerIsFiltered,
    isScannerParcelsLoading: mapOverlays.isScannerParcelsLoading,
    scannerParcelsError: mapOverlays.scannerParcelsError,
    isQuickViewVisible: mapOverlays.isQuickViewVisible,
    isScannerVisible: mapOverlays.isScannerVisible,
    isQuickViewDensityOk: mapOverlays.isQuickViewDensityOk,
    quickViewObjectCount: mapOverlays.quickViewObjectCount,
    isLayerPanelOpen,
    isMeasurePanelOpen,
    facilityDetailQuery,
    parcelDetailQuery,
    setPerspectiveVisibility,
    setBoundaryVisible,
    setBoundarySelectedRegionIds,
    setBasemapLayerVisible,
    setParcelsVisible,
    setPowerLayerVisible,
    setFiberLayerVisibility: fiber.setFiberLayerVisibility,
    setFiberSourceLayerVisible: fiber.setFiberSourceLayerVisible,
    setAllFiberSourceLayers: fiber.setAllFiberSourceLayers,
    setMeasureMode,
    setMeasureAreaShape,
    finishMeasureSelection,
    exportMeasureSelection,
    exportScannerSelection: mapOverlays.exportScannerSelection,
    clearMeasure,
    clearSelectedFacility,
    selectFacilityFromAnalysis,
    clearSelectedParcel,
    setQuickViewActive: mapOverlays.setQuickViewActive,
    toggleQuickView: mapOverlays.toggleQuickView,
    setScannerActive: mapOverlays.setScannerActive,
    toggleScanner: mapOverlays.toggleScanner,
    setQuickViewObjectCount: mapOverlays.setQuickViewObjectCount,
    toggleLayerPanel,
    toggleMeasurePanel,
  };
}
