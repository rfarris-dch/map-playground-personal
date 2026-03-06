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
    measureState,
    isLayerPanelOpen,
    isMeasurePanelOpen,
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
    measureState,
    isLayerPanelOpen,
    isMeasurePanelOpen,
  };
}

function buildAppShellOverlayViewModel(args: UseAppShellRuntimeResult) {
  const { mapOverlays, measureSelection } = args;
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
  const { measureSelectionSummary, measureSelectionError, isMeasureSelectionLoading } =
    measureSelection;

  return {
    measureSelectionSummary,
    measureSelectionError,
    isMeasureSelectionLoading,
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

function buildAppShellMeasureActions(args: UseAppShellRuntimeResult) {
  const { state, measureSelection } = args;
  const {
    setMeasureMode,
    setMeasureAreaShape,
    finishMeasureSelection,
    clearMeasure,
    toggleMeasurePanel,
  } = state;
  const { exportMeasureSelection } = measureSelection;

  return {
    setMeasureMode,
    setMeasureAreaShape,
    finishMeasureSelection,
    exportMeasureSelection,
    clearMeasure,
    toggleMeasurePanel,
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
    ...buildAppShellMeasureActions(args),
    ...buildAppShellOverlayActions(args),
  };
}

export function buildUseAppShellResult(args: UseAppShellRuntimeResult) {
  return {
    ...buildAppShellViewModel(args),
    ...buildAppShellActions(args),
  };
}
