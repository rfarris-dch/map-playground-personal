import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  FLOOD_100_LAYER_ID,
  FLOOD_500_LAYER_ID,
  HYDRO_BASINS_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import { useCountyScores } from "@/features/county-scores/use-county-scores";
import type { LayerRuntimeSnapshot } from "@/features/layers/layer-runtime.types";
import {
  applyMapContextTransferToAppShell,
  buildMapContextTransferFromAppShell,
  inferMapContextSurfaceFromRoute,
  readMapContextTransferFromRoute,
} from "@/features/map-context-transfer/map-context-transfer.service";
import { saveSpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.service";
import { buildScannerSpatialAnalysisSummary } from "@/features/spatial-analysis/spatial-analysis-summary.service";
import type { BoundaryFacetSelectionState } from "./app-shell.types";
import { useAppShellRuntime } from "./use-app-shell-runtime";

function resolveDashboardBoundaryFacetSelection(args: {
  readonly boundaryFacetSelection: BoundaryFacetSelectionState;
  readonly countyIds: readonly string[];
}): BoundaryFacetSelectionState {
  if (args.countyIds.length === 0) {
    return args.boundaryFacetSelection;
  }

  return {
    ...args.boundaryFacetSelection,
    county: args.countyIds,
  };
}

function showZoomHint(
  snapshot: LayerRuntimeSnapshot | null,
  layerId: typeof FLOOD_100_LAYER_ID | typeof FLOOD_500_LAYER_ID | typeof HYDRO_BASINS_LAYER_ID
): boolean {
  if (snapshot === null) {
    return false;
  }

  const userVisible = snapshot.userVisibility[layerId] ?? false;
  const effectiveVisible = snapshot.effectiveVisibility[layerId] ?? false;
  const stressBlocked = snapshot.stressBlocked[layerId] ?? false;
  return userVisible && !effectiveVisible && !stressBlocked;
}

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
  const showFlood100ZoomHint = computed(() =>
    showZoomHint(state.layerRuntimeSnapshot.value, FLOOD_100_LAYER_ID)
  );
  const showFlood500ZoomHint = computed(() =>
    showZoomHint(state.layerRuntimeSnapshot.value, FLOOD_500_LAYER_ID)
  );
  const showHydroBasinsZoomHint = computed(() =>
    showZoomHint(state.layerRuntimeSnapshot.value, HYDRO_BASINS_LAYER_ID)
  );
  const scannerCountyIds = computed(() => mapOverlays.scannerSummary.value.countyIds);
  const {
    countyScores: scannerCountyScores,
    countyScoresError: scannerCountyScoresError,
    countyScoresStatus: scannerCountyScoresStatus,
    countyScoresStatusError: scannerCountyScoresStatusError,
  } = useCountyScores({
    countyIds: scannerCountyIds,
  });
  const scannerAnalysisSummary = computed(() =>
    buildScannerSpatialAnalysisSummary({
      countyIds: scannerCountyIds.value,
      countyScores: scannerCountyScores.value,
      countyScoresError: scannerCountyScoresError.value,
      countyScoresStatus: scannerCountyScoresStatus.value,
      countyScoresStatusError: scannerCountyScoresStatusError.value,
      marketSelection: mapOverlays.scannerMarketSelection.value,
      summary: mapOverlays.scannerSummary.value,
    })
  );

  async function openSelectionDashboard(): Promise<void> {
    const summary = selectionAnalysis.selectionSummary.value;
    if (summary === null) {
      return;
    }

    const hasResults =
      summary.summary.totalCount > 0 ||
      summary.summary.parcelSelection.count > 0 ||
      (summary.summary.marketSelection?.matchCount ?? 0) > 0 ||
      summary.area.countyIds.length > 0;
    if (!hasResults) {
      return;
    }

    saveSpatialAnalysisDashboardState({
      createdAt: new Date().toISOString(),
      isFiltered: false,
      mapContext: buildMapContextTransferFromAppShell({
        boundaryFacetSelection: resolveDashboardBoundaryFacetSelection({
          boundaryFacetSelection: state.boundaryFacetSelection.value,
          countyIds: summary.area.countyIds,
        }),
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
    const summary = scannerAnalysisSummary.value;
    const hasResults =
      summary.summary.totalCount > 0 ||
      summary.summary.parcelSelection.count > 0 ||
      (summary.summary.marketSelection?.matchCount ?? 0) > 0 ||
      summary.area.countyIds.length > 0;
    if (!hasResults) {
      return;
    }

    saveSpatialAnalysisDashboardState({
      createdAt: new Date().toISOString(),
      isFiltered: mapOverlays.scannerIsFiltered.value,
      mapContext: buildMapContextTransferFromAppShell({
        boundaryFacetSelection: resolveDashboardBoundaryFacetSelection({
          boundaryFacetSelection: state.boundaryFacetSelection.value,
          countyIds: summary.area.countyIds,
        }),
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
    floodVisibility: visibility.floodVisibility,
    showFlood100ZoomHint,
    showFlood500ZoomHint,
    hydroBasinsVisible: visibility.hydroBasinsVisible,
    showHydroBasinsZoomHint,
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
    scannerAnalysisSummary,
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
    setFloodLayerVisible: visibility.setFloodLayerVisible,
    setHydroBasinsVisible: visibility.setHydroBasinsVisible,
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
