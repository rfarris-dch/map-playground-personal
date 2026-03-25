import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import { computed } from "vue";
import { useAppShellFiber } from "@/features/app/fiber/use-app-shell-fiber";
import { useMapFilters } from "@/features/app/filters/use-map-filters";
import { useAppShellMapLifecycle } from "@/features/app/lifecycle/use-app-shell-map-lifecycle";
import { resolveScannerParcelsBlockedReason } from "@/features/app/overlays/map-overlays.service";
import { useMapOverlays } from "@/features/app/overlays/use-map-overlays";
import { useAppShellSelection } from "@/features/app/selection/use-app-shell-selection";
import { useAppShellSelectionAnalysis } from "@/features/app/selection/use-app-shell-selection-analysis";
import { resolveUserVisibleLayerIds } from "@/features/app/visibility/app-shell-visibility.service";
import { useAppShellVisibility } from "@/features/app/visibility/use-app-shell-visibility";
import type { UseAppShellRuntimeResult } from "./use-app-shell.types";
import { useAppShellState } from "./use-app-shell-state";
import { useAppShellStatus } from "./use-app-shell-status";

interface UseAppShellRuntimeOptions {
  readonly initialViewport?: MapContextTransfer["viewport"];
}

export function useAppShellRuntime(
  options: UseAppShellRuntimeOptions = {}
): UseAppShellRuntimeResult {
  const state = useAppShellState();
  const areFacilityInteractionsEnabled = computed(
    () => state.sketchMeasureState.value.mode === "off"
  );

  const status = useAppShellStatus({
    facilitiesStatus: state.facilitiesStatus,
    parcelsStatus: state.parcelsStatus,
  });

  const selection = useAppShellSelection({
    facilitiesControllers: state.facilitiesControllers,
    parcelsController: state.parcelsController,
  });

  const visibility = useAppShellVisibility({
    basemapLayerController: state.basemapLayerController,
    boundaryControllers: state.boundaryControllers,
    boundaryFacetSelection: state.boundaryFacetSelection,
    countyPowerStoryController: state.countyPowerStoryController,
    countyPowerStoryVisibility: state.countyPowerStoryVisibility,
    clearCountyPowerStoryHover: () => {
      state.hoveredCountyPowerStory.value = null;
    },
    clearPowerHover: () => {
      state.powerHoverController.value?.clear();
      state.hoveredPower.value = null;
    },
    clearSelectedCountyPowerStory: selection.clearSelectedCountyPowerStory,
    clearSelectedParcel: selection.clearSelectedParcel,
    gasPipelineController: state.gasPipelineController,
    layerRuntime: state.layerRuntime,
    setViewportFacilities: state.setViewportFacilities,
  });
  const includeParcelsInAnalysis = computed(
    () =>
      visibility.parcelsVisible.value &&
      resolveScannerParcelsBlockedReason(state.parcelsStatus.value) === null
  );

  const mapFilters = useMapFilters();

  const fiber = useAppShellFiber({
    interactionCoordinator: state.interactionCoordinator,
    map: state.map,
    layerRuntime: state.layerRuntime,
    isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
  });

  const mapOverlays = useMapOverlays({
    map: state.map,
    interactionCoordinator: state.interactionCoordinator,
    expectedParcelsIngestionRunId: status.expectedParcelsIngestionRunId,
    facilitiesStatus: state.facilitiesStatus,
    visiblePerspectives: visibility.visiblePerspectives,
    colocationViewportFeatures: state.colocationViewportFeatures,
    hyperscaleViewportFeatures: state.hyperscaleViewportFeatures,
    parcelsStatus: state.parcelsStatus,
    clearSelectionGeometry: state.clearSelectionGeometry,
    clearSketchMeasure: state.clearSketchMeasure,
    dismissAllToolPanels: state.dismissAllToolPanels,
    finishSketchMeasureArea: state.finishSketchMeasureArea,
    isSketchMeasurePanelOpen: state.isSketchMeasurePanelOpen,
    setSketchMeasureMode: state.setSketchMeasureMode,
    sketchMeasureState: state.sketchMeasureState,
    toggleSketchMeasurePanel: state.toggleSketchMeasurePanel,
  });

  const selectionAnalysis = useAppShellSelectionAnalysis({
    expectedParcelsIngestionRunId: status.expectedParcelsIngestionRunId,
    includeParcels: includeParcelsInAnalysis,
    selectionGeometry: state.selectionGeometry,
    visiblePerspectives: visibility.visiblePerspectives,
  });

  const mapLifecycle = useAppShellMapLifecycle({
    actions: {
      clearSelectedCountyPowerStory: selection.clearSelectedCountyPowerStory,
      clearSelectedFacility: selection.clearSelectedFacility,
      clearSelectedParcel: selection.clearSelectedParcel,
      setSelectedCountyPowerStory: selection.setSelectedCountyPowerStory,
      setSelectedFacility: selection.setSelectedFacility,
      setSelectedParcel: selection.setSelectedParcel,
    },
    areFacilityInteractionsEnabled,
    fiber,
    filters: {
      facilitiesPredicate: mapFilters.facilitiesPredicate,
      onCachedFeaturesUpdate: mapFilters.setAvailableFeatures,
      onParcelViewportFacets: mapFilters.setParcelViewportFacets,
      parcelFilter: mapFilters.parcelFilter,
      parcelViewportFacets: mapFilters.parcelViewportFacets,
      transmissionFilter: mapFilters.transmissionFilter,
      gasFilter: mapFilters.gasFilter,
    },
    initialViewport: options.initialViewport,
    readInitialUserVisibleLayerIds: () =>
      resolveUserVisibleLayerIds({
        boundaryVisibility: visibility.boundaryVisibility.value,
        countyPowerStoryVisibility: state.countyPowerStoryVisibility.value,
        fiberVisibility: fiber.visibleFiberLayers.value,
        floodVisibility: visibility.floodVisibility.value,
        gasPipelineVisible: visibility.gasPipelineVisible.value,
        hydroBasinsVisible: visibility.hydroBasinsVisible.value,
        marketBoundaryVisibility: visibility.marketBoundaryVisibility.value,
        parcelsVisible: visibility.parcelsVisible.value,
        powerVisibility: visibility.powerVisibility.value,
        visiblePerspectives: visibility.visiblePerspectives.value,
        waterVisible: visibility.waterVisible.value,
      }),
    layers: {
      boundaryControllers: state.boundaryControllers,
      countyPowerStoryController: state.countyPowerStoryController,
      marketBoundaryControllers: state.marketBoundaryControllers,
      environmentalStressController: state.environmentalStressController,
      facilitiesControllers: state.facilitiesControllers,
      facilitiesHoverController: state.facilitiesHoverController,
      floodLayersController: state.floodLayersController,
      gasPipelineController: state.gasPipelineController,
      hydroBasinsController: state.hydroBasinsController,
      parcelsController: state.parcelsController,
      powerLayersController: state.powerLayersController,
      powerHoverController: state.powerHoverController,
      sketchMeasureController: state.sketchMeasureController,
      waterController: state.waterController,
    },
    runtime: {
      basemapLayerController: state.basemapLayerController,
      disposeMapRuntime: state.disposeMapRuntime,
      interactionCoordinator: state.interactionCoordinator,
      layerRuntime: state.layerRuntime,
      map: state.map,
      mapContainer: state.mapContainer,
      mapInitStatus: state.mapInitStatus,
    },
    state: {
      boundaryFetchError: state.boundaryFetchError,
      boundaryFacetOptions: state.boundaryFacetOptions,
      boundaryFacetSelection: state.boundaryFacetSelection,
      boundaryHoverByLayer: state.boundaryHoverByLayer,
      colocationViewportFeatures: state.colocationViewportFeatures,
      countyPowerStoryVisibility: state.countyPowerStoryVisibility,
      facilitiesStatus: state.facilitiesStatus,
      hoveredBoundary: state.hoveredBoundary,
      hoveredCountyPowerStory: state.hoveredCountyPowerStory,
      hoveredFacility: state.hoveredFacility,
      clusterClickSignal: state.clusterClickSignal,
      hoveredFacilityCluster: state.hoveredFacilityCluster,
      selectedFacilityHoverState: state.selectedFacilityHoverState,
      hoveredMarketBoundary: state.hoveredMarketBoundary,
      hoveredPower: state.hoveredPower,
      marketBoundaryColorMode: state.marketBoundaryColorMode,
      marketBoundaryFetchError: state.marketBoundaryFetchError,
      marketBoundaryFacetOptions: state.marketBoundaryFacetOptions,
      marketBoundaryFacetSelection: state.marketBoundaryFacetSelection,
      marketBoundaryHoverByLayer: state.marketBoundaryHoverByLayer,
      hyperscaleViewportFeatures: state.hyperscaleViewportFeatures,
      layerRuntimeSnapshot: state.layerRuntimeSnapshot,
      parcelsStatus: state.parcelsStatus,
      perspectiveViewModes: state.perspectiveViewModes,
      selectedCountyPowerStory: selection.selectedCountyPowerStory,
      selectedFacility: selection.selectedFacility,
      selectedParcel: selection.selectedParcel,
      sketchMeasureState: state.sketchMeasureState,
    },
    visibility,
  });

  return {
    mapFilters,
    state,
    status,
    selection,
    visibility,
    fiber,
    mapOverlays,
    selectionAnalysis,
    mapLifecycle,
  };
}
