import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  applyMapContextTransferToAppShell,
  buildMapContextTransferFromAppShell,
  inferMapContextSurfaceFromRoute,
  readMapContextTransferFromRoute,
} from "@/features/map-context-transfer/map-context-transfer.service";
import { saveSpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.service";
import { useAppShellRuntime } from "./use-app-shell-runtime";

export function useAppShell() {
  const route = useRoute();
  const router = useRouter();
  const initialMapContext = readMapContextTransferFromRoute({ route });
  const currentSurface = inferMapContextSurfaceFromRoute(route) ?? "global-map";
  const runtime = useAppShellRuntime({
    initialViewport: initialMapContext?.viewport,
  });
  const {
    state,
    status,
    selection,
    visibility,
    fiber,
    mapOverlays,
    selectionAnalysis,
    mapLifecycle,
  } = runtime;

  applyMapContextTransferToAppShell({
    context: initialMapContext,
    setBoundarySelectedRegionIds(boundaryId, selectedRegionIds) {
      state.boundaryFacetSelection.value = {
        ...state.boundaryFacetSelection.value,
        [boundaryId]: selectedRegionIds,
      };
    },
    setBoundaryVisible: visibility.setBoundaryVisible,
    setPerspectiveVisibility: visibility.setPerspectiveVisibility,
  });

  const selectionDisabledReason = computed(() =>
    state.selectionGeometry.value === null ? "Commit a sketch as a selection first." : null
  );

  async function openSelectionDashboard(): Promise<void> {
    const summary = selectionAnalysis.selectionSummary.value;
    if (summary === null) {
      return;
    }

    const hasResults =
      summary.totalCount > 0 ||
      summary.parcelSelection.count > 0 ||
      summary.marketSelection.matchCount > 0;
    if (!hasResults) {
      return;
    }

    saveSpatialAnalysisDashboardState({
      createdAt: new Date().toISOString(),
      isFiltered: false,
      mapContext: buildMapContextTransferFromAppShell({
        boundaryFacetSelection: state.boundaryFacetSelection.value,
        map: state.map.value,
        sourceSurface: currentSurface,
        targetSurface: "global-map",
        visiblePerspectives: visibility.visiblePerspectives.value,
      }),
      source: "selection",
      summary,
      title: "Selection Dashboard",
    });

    await router.push({ name: "spatial-analysis-dashboard" });
  }

  async function openScannerDashboard(): Promise<void> {
    const summary = mapOverlays.scannerSummary.value;
    const hasResults = summary.totalCount > 0 || summary.parcelSelection.count > 0;
    if (!hasResults) {
      return;
    }

    saveSpatialAnalysisDashboardState({
      createdAt: new Date().toISOString(),
      isFiltered: mapOverlays.scannerIsFiltered.value,
      mapContext: buildMapContextTransferFromAppShell({
        boundaryFacetSelection: state.boundaryFacetSelection.value,
        map: state.map.value,
        sourceSurface: currentSurface,
        targetSurface: "global-map",
        visiblePerspectives: visibility.visiblePerspectives.value,
      }),
      source: "scanner",
      summary,
      title: "Scanner Dashboard",
    });

    await router.push({ name: "spatial-analysis-dashboard" });
  }

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
    waterVisible: visibility.waterVisible,
    visibleFiberLayers: fiber.visibleFiberLayers,
    fiberStatusText: fiber.fiberStatusText,
    fiberSourceLayerOptions: fiber.fiberSourceLayerOptions,
    selectedFiberSourceLayerNames: fiber.selectedFiberSourceLayerNames,
    sketchMeasureState: state.sketchMeasureState,
    selectionGeometry: state.selectionGeometry,
    selectionProgress: selectionAnalysis.selectionProgress,
    selectionSummary: selectionAnalysis.selectionSummary,
    selectionError: selectionAnalysis.selectionError,
    isSelectionLoading: selectionAnalysis.isSelectionLoading,
    selectionDisabledReason,
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
    isSketchMeasurePanelOpen: state.isSketchMeasurePanelOpen,
    isSelectionPanelOpen: state.isSelectionPanelOpen,
    facilityDetailQuery: selection.facilityDetailQuery,
    parcelDetailQuery: selection.parcelDetailQuery,
    setPerspectiveVisibility: visibility.setPerspectiveVisibility,
    setBoundaryVisible: visibility.setBoundaryVisible,
    setBoundarySelectedRegionIds: mapLifecycle.setBoundarySelectedRegionIds,
    setBasemapLayerVisible: visibility.setBasemapLayerVisible,
    setParcelsVisible: visibility.setParcelsVisible,
    setPowerLayerVisible: visibility.setPowerLayerVisible,
    setWaterVisible: visibility.setWaterVisible,
    setFiberLayerVisibility: fiber.setFiberLayerVisibility,
    setFiberSourceLayerVisible: fiber.setFiberSourceLayerVisible,
    setAllFiberSourceLayers: fiber.setAllFiberSourceLayers,
    setSketchMeasureMode: state.setSketchMeasureMode,
    setSketchMeasureAreaShape: state.setSketchMeasureAreaShape,
    finishSketchMeasureArea: state.finishSketchMeasureArea,
    exportSelection: selectionAnalysis.exportSelection,
    openSelectionDashboard,
    exportScannerSelection: mapOverlays.exportScannerSelection,
    openScannerDashboard,
    clearSketchMeasure: state.clearSketchMeasure,
    useCompletedSketchAsSelection: state.useCompletedSketchAsSelection,
    clearSelection: state.clearSelectionGeometry,
    clearSelectionGeometry: state.clearSelectionGeometry,
    clearSelectedFacility: selection.clearSelectedFacility,
    selectFacilityFromAnalysis: selection.selectFacilityFromAnalysis,
    clearSelectedParcel: selection.clearSelectedParcel,
    setQuickViewActive: mapOverlays.setQuickViewActive,
    toggleQuickView: mapOverlays.toggleQuickView,
    setScannerActive: mapOverlays.setScannerActive,
    toggleScanner: mapOverlays.toggleScanner,
    setQuickViewObjectCount: mapOverlays.setQuickViewObjectCount,
    toggleLayerPanel: state.toggleLayerPanel,
    toggleSketchMeasurePanel: state.toggleSketchMeasurePanel,
    toggleSelectionPanel: state.toggleSelectionPanel,
  };
}
