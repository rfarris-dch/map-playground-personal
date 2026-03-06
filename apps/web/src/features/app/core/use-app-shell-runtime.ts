import { computed } from "vue";
import { useAppShellFiber } from "@/features/app/fiber/use-app-shell-fiber";
import { useAppShellMapLifecycle } from "@/features/app/lifecycle/use-app-shell-map-lifecycle";
import { useAppShellMeasureSelection } from "@/features/app/measure-selection/use-app-shell-measure-selection";
import { useMapOverlays } from "@/features/app/overlays/use-map-overlays";
import { useAppShellSelection } from "@/features/app/selection/use-app-shell-selection";
import { useAppShellVisibility } from "@/features/app/visibility/use-app-shell-visibility";
import type { UseAppShellRuntimeResult } from "./use-app-shell.types";
import { useAppShellState } from "./use-app-shell-state";
import { useAppShellStatus } from "./use-app-shell-status";

export function useAppShellRuntime(): UseAppShellRuntimeResult {
  const state = useAppShellState();
  const areFacilityInteractionsEnabled = computed(() => state.measureState.value.mode === "off");

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
    clearPowerHover: () => {
      state.powerHoverController.value?.clear();
      state.hoveredPower.value = null;
    },
    clearSelectedParcel: selection.clearSelectedParcel,
    layerRuntime: state.layerRuntime,
    setViewportFacilities: state.setViewportFacilities,
  });

  const fiber = useAppShellFiber({
    map: state.map,
    layerRuntime: state.layerRuntime,
    isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
  });

  const mapOverlays = useMapOverlays({
    map: state.map,
    measureState: state.measureState,
    expectedParcelsIngestionRunId: status.expectedParcelsIngestionRunId,
    facilitiesStatus: state.facilitiesStatus,
    visiblePerspectives: visibility.visiblePerspectives,
    colocationViewportFeatures: state.colocationViewportFeatures,
    hyperscaleViewportFeatures: state.hyperscaleViewportFeatures,
    clearMeasure: state.clearMeasure,
    finishMeasureSelection: state.finishMeasureSelection,
    setMeasureMode: state.setMeasureMode,
  });

  const measureSelection = useAppShellMeasureSelection({
    expectedParcelsIngestionRunId: status.expectedParcelsIngestionRunId,
    measureState: state.measureState,
    visiblePerspectives: visibility.visiblePerspectives,
  });

  const mapLifecycle = useAppShellMapLifecycle({
    actions: {
      clearSelectedFacility: selection.clearSelectedFacility,
      clearSelectedParcel: selection.clearSelectedParcel,
      setSelectedFacility: selection.setSelectedFacility,
      setSelectedParcel: selection.setSelectedParcel,
    },
    areFacilityInteractionsEnabled,
    fiber,
    layers: {
      boundaryControllers: state.boundaryControllers,
      facilitiesControllers: state.facilitiesControllers,
      facilitiesHoverController: state.facilitiesHoverController,
      measureController: state.measureController,
      parcelsController: state.parcelsController,
      powerControllers: state.powerControllers,
      powerHoverController: state.powerHoverController,
      waterController: state.waterController,
    },
    runtime: {
      basemapLayerController: state.basemapLayerController,
      disposePmtilesProtocol: state.disposePmtilesProtocol,
      layerRuntime: state.layerRuntime,
      map: state.map,
      mapContainer: state.mapContainer,
      mapControls: state.mapControls,
      restoreConsoleWarn: state.restoreConsoleWarn,
    },
    state: {
      boundaryFacetOptions: state.boundaryFacetOptions,
      boundaryFacetSelection: state.boundaryFacetSelection,
      boundaryHoverByLayer: state.boundaryHoverByLayer,
      colocationViewportFeatures: state.colocationViewportFeatures,
      facilitiesStatus: state.facilitiesStatus,
      hoveredBoundary: state.hoveredBoundary,
      hoveredFacility: state.hoveredFacility,
      hoveredPower: state.hoveredPower,
      hyperscaleViewportFeatures: state.hyperscaleViewportFeatures,
      measureState: state.measureState,
      parcelsStatus: state.parcelsStatus,
      selectedFacility: selection.selectedFacility,
      selectedParcel: selection.selectedParcel,
    },
    visibility,
  });

  return {
    state,
    status,
    selection,
    visibility,
    fiber,
    mapOverlays,
    measureSelection,
    mapLifecycle,
  };
}
