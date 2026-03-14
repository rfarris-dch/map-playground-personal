import type { MapContextTransfer } from "@map-migration/contracts";
import { computed } from "vue";
import { useAppShellFiber } from "@/features/app/fiber/use-app-shell-fiber";
import { useMapFilters } from "@/features/app/filters/use-map-filters";
import { useAppShellMapLifecycle } from "@/features/app/lifecycle/use-app-shell-map-lifecycle";
import { resolveScannerParcelsBlockedReason } from "@/features/app/overlays/map-overlays.service";
import { useMapOverlays } from "@/features/app/overlays/use-map-overlays";
import { useAppShellSelection } from "@/features/app/selection/use-app-shell-selection";
import { useAppShellSelectionAnalysis } from "@/features/app/selection/use-app-shell-selection-analysis";
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
    clearPowerHover: () => {
      state.powerHoverController.value?.clear();
      state.hoveredPower.value = null;
    },
    clearSelectedParcel: selection.clearSelectedParcel,
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
    map: state.map,
    layerRuntime: state.layerRuntime,
    isInteractionEnabled: () => areFacilityInteractionsEnabled.value,
  });

  const mapOverlays = useMapOverlays({
    map: state.map,
    expectedParcelsIngestionRunId: status.expectedParcelsIngestionRunId,
    facilitiesStatus: state.facilitiesStatus,
    visiblePerspectives: visibility.visiblePerspectives,
    colocationViewportFeatures: state.colocationViewportFeatures,
    hyperscaleViewportFeatures: state.hyperscaleViewportFeatures,
    parcelsStatus: state.parcelsStatus,
    clearSketchMeasure: state.clearSketchMeasure,
    finishSketchMeasureArea: state.finishSketchMeasureArea,
    setSketchMeasureMode: state.setSketchMeasureMode,
    sketchMeasureState: state.sketchMeasureState,
  });

  const selectionAnalysis = useAppShellSelectionAnalysis({
    expectedParcelsIngestionRunId: status.expectedParcelsIngestionRunId,
    includeParcels: includeParcelsInAnalysis,
    selectionGeometry: state.selectionGeometry,
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
    filters: {
      facilitiesPredicate: mapFilters.facilitiesPredicate,
      onCachedFeaturesUpdate: mapFilters.setAvailableFeatures,
      parcelFilter: mapFilters.parcelFilter,
      transmissionFilter: mapFilters.transmissionFilter,
    },
    initialViewport: options.initialViewport,
    layers: {
      boundaryControllers: state.boundaryControllers,
      environmentalStressController: state.environmentalStressController,
      facilitiesControllers: state.facilitiesControllers,
      facilitiesHoverController: state.facilitiesHoverController,
      floodLayersController: state.floodLayersController,
      hydroBasinsController: state.hydroBasinsController,
      parcelsController: state.parcelsController,
      powerControllers: state.powerControllers,
      powerHoverController: state.powerHoverController,
      sketchMeasureController: state.sketchMeasureController,
      waterController: state.waterController,
    },
    runtime: {
      basemapLayerController: state.basemapLayerController,
      disposeMapRuntime: state.disposeMapRuntime,
      layerRuntime: state.layerRuntime,
      map: state.map,
      mapContainer: state.mapContainer,
    },
    state: {
      boundaryFacetOptions: state.boundaryFacetOptions,
      boundaryFacetSelection: state.boundaryFacetSelection,
      boundaryHoverByLayer: state.boundaryHoverByLayer,
      colocationViewportFeatures: state.colocationViewportFeatures,
      facilitiesStatus: state.facilitiesStatus,
      hoveredBoundary: state.hoveredBoundary,
      hoveredFacility: state.hoveredFacility,
      hoveredFacilityCluster: state.hoveredFacilityCluster,
      hoveredPower: state.hoveredPower,
      hyperscaleViewportFeatures: state.hyperscaleViewportFeatures,
      layerRuntimeSnapshot: state.layerRuntimeSnapshot,
      parcelsStatus: state.parcelsStatus,
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
