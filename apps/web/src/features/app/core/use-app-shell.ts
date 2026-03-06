import { computed } from "vue";
import { useAppShellState } from "@/features/app/core/use-app-shell-state";
import { useAppShellStatus } from "@/features/app/core/use-app-shell-status";
import { useAppShellFiber } from "@/features/app/fiber/use-app-shell-fiber";
import { useAppShellMapLifecycle } from "@/features/app/lifecycle/use-app-shell-map-lifecycle";
import { useAppShellMeasureSelection } from "@/features/app/measure-selection/use-app-shell-measure-selection";
import { useMapOverlays } from "@/features/app/overlays/use-map-overlays";
import { useAppShellSelection } from "@/features/app/selection/use-app-shell-selection";
import { useAppShellVisibility } from "@/features/app/visibility/use-app-shell-visibility";

export function useAppShell() {
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
    mapContainer: state.mapContainer,
    map: state.map,
    selectedFacility: selection.selectedFacility,
    selectedParcel: selection.selectedParcel,
    hoveredFacility: state.hoveredFacility,
    hoveredBoundary: state.hoveredBoundary,
    hoveredFiber: fiber.hoveredFiber,
    hoveredPower: state.hoveredPower,
    basemapVisibility: visibility.basemapVisibility,
    boundaryVisibility: visibility.boundaryVisibility,
    boundaryFacetOptions: state.boundaryFacetOptions,
    boundaryFacetSelection: state.boundaryFacetSelection,
    visiblePerspectives: visibility.visiblePerspectives,
    colocationStatusText: status.colocationStatusText,
    hyperscaleStatusText: status.hyperscaleStatusText,
    parcelsVisible: visibility.parcelsVisible,
    parcelsStatusText: status.parcelsStatusText,
    powerVisibility: visibility.powerVisibility,
    visibleFiberLayers: fiber.visibleFiberLayers,
    fiberStatusText: fiber.fiberStatusText,
    fiberSourceLayerOptions: fiber.fiberSourceLayerOptions,
    selectedFiberSourceLayerNames: fiber.selectedFiberSourceLayerNames,
    measureState: state.measureState,
    measureSelectionSummary: measureSelection.measureSelectionSummary,
    measureSelectionError: measureSelection.measureSelectionError,
    isMeasureSelectionLoading: measureSelection.isMeasureSelectionLoading,
    quickViewActive: mapOverlays.quickViewActive,
    scannerActive: mapOverlays.scannerActive,
    scannerSummary: mapOverlays.scannerSummary,
    scannerFacilities: mapOverlays.scannerFacilities,
    scannerTotalCount: mapOverlays.scannerTotalCount,
    scannerIsFiltered: mapOverlays.scannerIsFiltered,
    overlaysBlockedReason: mapOverlays.overlaysBlockedReason,
    quickViewDisabledReason: mapOverlays.quickViewDisabledReason,
    scannerEmptyMessage: mapOverlays.scannerEmptyMessage,
    overlayStatusMessage: mapOverlays.overlayStatusMessage,
    isScannerParcelsLoading: mapOverlays.isScannerParcelsLoading,
    scannerParcelsError: mapOverlays.scannerParcelsError,
    isQuickViewVisible: mapOverlays.isQuickViewVisible,
    isScannerVisible: mapOverlays.isScannerVisible,
    isQuickViewDensityOk: mapOverlays.isQuickViewDensityOk,
    quickViewObjectCount: mapOverlays.quickViewObjectCount,
    isLayerPanelOpen: state.isLayerPanelOpen,
    isMeasurePanelOpen: state.isMeasurePanelOpen,
    facilityDetailQuery: selection.facilityDetailQuery,
    parcelDetailQuery: selection.parcelDetailQuery,
    setPerspectiveVisibility: visibility.setPerspectiveVisibility,
    setBoundaryVisible: visibility.setBoundaryVisible,
    setBoundarySelectedRegionIds: mapLifecycle.setBoundarySelectedRegionIds,
    setBasemapLayerVisible: visibility.setBasemapLayerVisible,
    setParcelsVisible: visibility.setParcelsVisible,
    setPowerLayerVisible: visibility.setPowerLayerVisible,
    setFiberLayerVisibility: fiber.setFiberLayerVisibility,
    setFiberSourceLayerVisible: fiber.setFiberSourceLayerVisible,
    setAllFiberSourceLayers: fiber.setAllFiberSourceLayers,
    setMeasureMode: state.setMeasureMode,
    setMeasureAreaShape: state.setMeasureAreaShape,
    finishMeasureSelection: state.finishMeasureSelection,
    exportMeasureSelection: measureSelection.exportMeasureSelection,
    exportScannerSelection: mapOverlays.exportScannerSelection,
    clearMeasure: state.clearMeasure,
    clearSelectedFacility: selection.clearSelectedFacility,
    selectFacilityFromAnalysis: selection.selectFacilityFromAnalysis,
    clearSelectedParcel: selection.clearSelectedParcel,
    setQuickViewActive: mapOverlays.setQuickViewActive,
    toggleQuickView: mapOverlays.toggleQuickView,
    setScannerActive: mapOverlays.setScannerActive,
    toggleScanner: mapOverlays.toggleScanner,
    setQuickViewObjectCount: mapOverlays.setQuickViewObjectCount,
    toggleLayerPanel: state.toggleLayerPanel,
    toggleMeasurePanel: state.toggleMeasurePanel,
  };
}
