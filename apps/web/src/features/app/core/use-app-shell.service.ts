import type { UseAppShellRuntimeResult } from "./use-app-shell.types";

function buildAppShellMapViewModel(args: UseAppShellRuntimeResult) {
  const { state, selection, fiber } = args;
  const { mapContainer, map, hoveredFacility, hoveredBoundary, hoveredPower } = state;
  const { selectedFacility, selectedParcel, facilityDetailQuery, parcelDetailQuery } = selection;
  const { hoveredFiber } = fiber;

  return {
    mapContainer,
    map,
    selectedFacility,
    selectedParcel,
    hoveredFacility,
    hoveredBoundary,
    hoveredFiber,
    hoveredPower,
    facilityDetailQuery,
    parcelDetailQuery,
  };
}

function buildAppShellLayerViewModel(args: UseAppShellRuntimeResult) {
  const { state, status, visibility, fiber } = args;
  const {
    boundaryFacetOptions,
    boundaryFacetSelection,
    isLayerPanelOpen,
    isSelectionPanelOpen,
    isSketchMeasurePanelOpen,
    selectionGeometry,
    sketchMeasureState,
  } = state;
  const { colocationStatusText, hyperscaleStatusText, parcelsStatusText } = status;
  const {
    basemapVisibility,
    boundaryVisibility,
    visiblePerspectives,
    parcelsVisible,
    powerVisibility,
    waterVisible,
  } = visibility;
  const {
    visibleFiberLayers,
    fiberStatusText,
    fiberSourceLayerOptions,
    selectedFiberSourceLayerNames,
  } = fiber;

  return {
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
    waterVisible,
    visibleFiberLayers,
    fiberStatusText,
    fiberSourceLayerOptions,
    selectedFiberSourceLayerNames,
    sketchMeasureState,
    selectionGeometry,
    isLayerPanelOpen,
    isSketchMeasurePanelOpen,
    isSelectionPanelOpen,
    selectionDisabledReason:
      selectionGeometry.value === null ? "Commit a completed sketch first." : null,
  };
}

function buildAppShellOverlayViewModel(args: UseAppShellRuntimeResult) {
  const { mapOverlays, selectionAnalysis } = args;
  const {
    quickViewActive,
    scannerActive,
    scannerSummary,
    scannerFacilities,
    scannerTotalCount,
    scannerIsFiltered,
    overlaysBlockedReason,
    quickViewDisabledReason,
    scannerEmptyMessage,
    overlayStatusMessage,
    isScannerParcelsLoading,
    scannerParcelsError,
    isQuickViewVisible,
    isScannerVisible,
    isQuickViewDensityOk,
    quickViewObjectCount,
  } = mapOverlays;
  const { selectionSummary, selectionError, isSelectionLoading } = selectionAnalysis;

  return {
    selectionSummary,
    selectionError,
    isSelectionLoading,
    quickViewActive,
    scannerActive,
    scannerSummary,
    scannerFacilities,
    scannerTotalCount,
    scannerIsFiltered,
    overlaysBlockedReason,
    quickViewDisabledReason,
    scannerEmptyMessage,
    overlayStatusMessage,
    isScannerParcelsLoading,
    scannerParcelsError,
    isQuickViewVisible,
    isScannerVisible,
    isQuickViewDensityOk,
    quickViewObjectCount,
  };
}

function buildAppShellViewModel(args: UseAppShellRuntimeResult) {
  return {
    ...buildAppShellMapViewModel(args),
    ...buildAppShellLayerViewModel(args),
    ...buildAppShellOverlayViewModel(args),
  };
}

function buildAppShellLayerActions(args: UseAppShellRuntimeResult) {
  const { visibility, fiber, mapLifecycle } = args;
  const {
    setPerspectiveVisibility,
    setBoundaryVisible,
    setBasemapLayerVisible,
    setParcelsVisible,
    setPowerLayerVisible,
    setWaterVisible,
  } = visibility;
  const { setFiberLayerVisibility, setFiberSourceLayerVisible, setAllFiberSourceLayers } = fiber;
  const { setBoundarySelectedRegionIds } = mapLifecycle;

  return {
    setPerspectiveVisibility,
    setBoundaryVisible,
    setBoundarySelectedRegionIds,
    setBasemapLayerVisible,
    setParcelsVisible,
    setPowerLayerVisible,
    setWaterVisible,
    setFiberLayerVisibility,
    setFiberSourceLayerVisible,
    setAllFiberSourceLayers,
  };
}

function buildAppShellSketchMeasureActions(args: UseAppShellRuntimeResult) {
  const { state, selectionAnalysis } = args;
  const {
    setSketchMeasureMode,
    setSketchMeasureAreaShape,
    finishSketchMeasureArea,
    useCompletedSketchAsSelection,
    clearSketchMeasure,
    clearSelectionGeometry,
    toggleSketchMeasurePanel,
    toggleSelectionPanel,
  } = state;
  const { exportSelection } = selectionAnalysis;

  return {
    setSketchMeasureMode,
    setSketchMeasureAreaShape,
    finishSketchMeasureArea,
    useCompletedSketchAsSelection,
    exportSelection,
    clearSketchMeasure,
    clearSelectionGeometry,
    toggleSketchMeasurePanel,
    toggleSelectionPanel,
  };
}

function buildAppShellOverlayActions(args: UseAppShellRuntimeResult) {
  const { selection, mapOverlays, state } = args;
  const { clearSelectedFacility, selectFacilityFromAnalysis, clearSelectedParcel } = selection;
  const {
    exportScannerSelection,
    setQuickViewActive,
    toggleQuickView,
    setScannerActive,
    toggleScanner,
    setQuickViewObjectCount,
  } = mapOverlays;
  const { toggleLayerPanel } = state;

  return {
    exportScannerSelection,
    clearSelectedFacility,
    selectFacilityFromAnalysis,
    clearSelectedParcel,
    setQuickViewActive,
    toggleQuickView,
    setScannerActive,
    toggleScanner,
    setQuickViewObjectCount,
    toggleLayerPanel,
  };
}

function buildAppShellActions(args: UseAppShellRuntimeResult) {
  return {
    ...buildAppShellLayerActions(args),
    ...buildAppShellSketchMeasureActions(args),
    ...buildAppShellOverlayActions(args),
  };
}

export function buildUseAppShellResult(args: UseAppShellRuntimeResult) {
  return {
    ...buildAppShellViewModel(args),
    ...buildAppShellActions(args),
  };
}
