import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { computed, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  FLOOD_100_LAYER_ID,
  FLOOD_500_LAYER_ID,
  HYDRO_BASINS_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import { exportMapView } from "@/features/app/map-export/map-export.service";
import type { MapViewExportFormat } from "@/features/app/map-export/map-export.types";
import { useCountyScores } from "@/features/county-intelligence/use-county-intelligence";
import type {
  FacilitiesViewMode,
  SelectedFacilityRef,
} from "@/features/facilities/facilities.types";
import type { LayerRuntimeSnapshot } from "@/features/layers/layer-runtime.types";
import {
  buildMapContextTransferFromAppShell,
  inferMapContextSurfaceFromRoute,
  readMapContextTransferFromRoute,
} from "@/features/map-context-transfer/map-context-transfer.service";
import { buildFacilityDetailPageRoute } from "@/features/navigation/navigation.service";
import { executeOpenDashboard } from "@/features/spatial-analysis/commands/open-dashboard.command";
import { buildScannerSpatialAnalysisSummary } from "@/features/spatial-analysis/spatial-analysis-summary.service";
import type { BoundaryFacetSelectionState } from "./app-shell.types";
import { useAppShellRuntime } from "./use-app-shell-runtime";
import { useAppShellUrlState } from "./use-app-shell-url-state";

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
  const currentSurface = computed(() => inferMapContextSurfaceFromRoute(route) ?? "global-map");

  function navigateToFacilityDetail(facility: SelectedFacilityRef): void {
    router.push(
      buildFacilityDetailPageRoute({
        facilityId: facility.facilityId,
        perspective: facility.perspective,
      })
    );
  }

  function resetMapToDefault(): void {
    router.replace({ path: "/map" });
  }

  const runtime = useAppShellRuntime({
    initialViewport: initialMapContext?.viewport,
  });
  const {
    mapFilters,
    state,
    status,
    selection,
    visibility,
    fiber,
    mapOverlays,
    selectionAnalysis,
    mapLifecycle,
  } = runtime;

  useAppShellUrlState({
    basemapVisibility: visibility.basemapVisibility,
    boundaryFacetSelection: state.boundaryFacetSelection,
    boundaryVisibility: visibility.boundaryVisibility,
    currentSurface,
    fiberVisibility: fiber.visibleFiberLayers,
    floodVisibility: visibility.floodVisibility,
    hydroBasinsVisible: visibility.hydroBasinsVisible,
    layerRuntimeSnapshot: state.layerRuntimeSnapshot,
    map: state.map,
    parcelsVisible: visibility.parcelsVisible,
    powerVisibility: visibility.powerVisibility,
    selectedFiberSourceLayerNames: fiber.selectedFiberSourceLayerNames,
    setBasemapLayerVisible: visibility.setBasemapLayerVisible,
    setBoundarySelectedRegionIds: mapLifecycle.setBoundarySelectedRegionIds,
    setBoundaryVisible: visibility.setBoundaryVisible,
    setFiberLayerVisibility: fiber.setFiberLayerVisibility,
    setFiberSourceLayerSelection: fiber.setFiberSourceLayerSelection,
    setFloodLayerVisible: visibility.setFloodLayerVisible,
    setHydroBasinsVisible: visibility.setHydroBasinsVisible,
    setParcelsVisible: visibility.setParcelsVisible,
    setPerspectiveVisibility: visibility.setPerspectiveVisibility,
    setPowerLayerVisible: visibility.setPowerLayerVisible,
    setWaterVisible: visibility.setWaterVisible,
    visiblePerspectives: visibility.visiblePerspectives,
    waterVisible: visibility.waterVisible,
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
  const isMapExporting = shallowRef(false);
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

  function buildDashboardMapContext(countyIds: readonly string[]) {
    return buildMapContextTransferFromAppShell({
      boundaryFacetSelection: resolveDashboardBoundaryFacetSelection({
        boundaryFacetSelection: state.boundaryFacetSelection.value,
        countyIds,
      }),
      basemapVisibility: visibility.basemapVisibility.value,
      layerRuntimeSnapshot: state.layerRuntimeSnapshot.value,
      map: state.map.value,
      boundaryVisibility: visibility.boundaryVisibility.value,
      fiberVisibility: fiber.visibleFiberLayers.value,
      floodVisibility: visibility.floodVisibility.value,
      hydroBasinsVisible: visibility.hydroBasinsVisible.value,
      parcelsVisible: visibility.parcelsVisible.value,
      powerVisibility: visibility.powerVisibility.value,
      selectedFiberSourceLayerNames: fiber.selectedFiberSourceLayerNames.value,
      sourceSurface: currentSurface.value,
      targetSurface: "global-map",
      visiblePerspectives: visibility.visiblePerspectives.value,
      waterVisible: visibility.waterVisible.value,
    });
  }

  async function openSelectionDashboard(): Promise<void> {
    const summary = selectionAnalysis.selectionSummary.value;
    if (summary === null) {
      return;
    }

    await executeOpenDashboard(
      {
        source: "selection",
        title: "Selection Dashboard",
        isFiltered: false,
        summary,
        mapContext: buildDashboardMapContext(summary.area.countyIds),
      },
      router
    );
  }

  async function openScannerDashboard(): Promise<void> {
    const summary = scannerAnalysisSummary.value;

    await executeOpenDashboard(
      {
        source: "scanner",
        title: "Scanner Dashboard",
        isFiltered: mapOverlays.scannerIsFiltered.value,
        summary,
        mapContext: buildDashboardMapContext(summary.area.countyIds),
      },
      router
    );
  }

  async function exportCurrentMapView(format: MapViewExportFormat): Promise<void> {
    const map = state.map.value;
    if (map === null || isMapExporting.value) {
      return;
    }

    isMapExporting.value = true;

    try {
      await exportMapView({ format, map });
    } catch (error: unknown) {
      console.error("[map] current map export failed", error);
    } finally {
      isMapExporting.value = false;
    }
  }

  const mapExportDisabledReason = computed(() =>
    state.map.value === null ? "Map is still initializing." : null
  );

  function setPerspectiveViewMode(
    perspective: FacilityPerspective,
    mode: FacilitiesViewMode
  ): void {
    for (const controller of state.facilitiesControllers.value) {
      if (controller.perspective === perspective) {
        controller.setViewMode(mode);
      }
    }
  }

  function zoomToCluster(
    perspective: FacilityPerspective,
    clusterId: number,
    center: readonly [number, number]
  ): void {
    for (const controller of state.facilitiesControllers.value) {
      if (controller.perspective === perspective) {
        controller.zoomToCluster(clusterId, [center[0], center[1]]);
      }
    }
  }

  return {
    mapFilters,
    mapContainer: state.mapContainer,
    map: state.map,
    selectedFacility: selection.selectedFacility,
    selectedParcel: selection.selectedParcel,
    hoveredFacility: state.hoveredFacility,
    hoveredFacilityCluster: state.hoveredFacilityCluster,
    hoveredBoundary: state.hoveredBoundary,
    hoveredMarketBoundary: state.hoveredMarketBoundary,
    hoveredFiber: fiber.hoveredFiber,
    hoveredPower: state.hoveredPower,
    basemapVisibility: visibility.basemapVisibility,
    boundaryVisibility: visibility.boundaryVisibility,
    boundaryFacetOptions: state.boundaryFacetOptions,
    boundaryFacetSelection: state.boundaryFacetSelection,
    visiblePerspectives: visibility.visiblePerspectives,
    facilitiesStatus: state.facilitiesStatus,
    colocationStatusText: status.colocationStatusText,
    hyperscaleStatusText: status.hyperscaleStatusText,
    floodVisibility: visibility.floodVisibility,
    showFlood100ZoomHint,
    showFlood500ZoomHint,
    hydroBasinsVisible: visibility.hydroBasinsVisible,
    showHydroBasinsZoomHint,
    gasPipelineVisible: visibility.gasPipelineVisible,
    marketBoundaryVisibility: visibility.marketBoundaryVisibility,
    parcelsVisible: visibility.parcelsVisible,
    parcelsStatusText: status.parcelsStatusText,
    powerVisibility: visibility.powerVisibility,
    waterVisible: visibility.waterVisible,
    marketBoundaryColorMode: state.marketBoundaryColorMode,
    marketBoundaryFacetOptions: state.marketBoundaryFacetOptions,
    marketBoundaryFacetSelection: state.marketBoundaryFacetSelection,
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
    isMapExporting,
    selectionDisabledReason,
    quickViewActive: mapOverlays.quickViewActive,
    scannerActive: mapOverlays.scannerActive,
    scannerSummary: mapOverlays.scannerSummary,
    scannerAnalysisSummary,
    scannerFacilities: mapOverlays.scannerFacilities,
    scannerTotalCount: mapOverlays.scannerTotalCount,
    scannerIsFiltered: mapOverlays.scannerIsFiltered,
    mapExportDisabledReason,
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
    setPerspectiveViewMode,
    zoomToCluster,
    setPerspectiveVisibility: visibility.setPerspectiveVisibility,
    setBoundaryVisible: visibility.setBoundaryVisible,
    setBoundarySelectedRegionIds: mapLifecycle.setBoundarySelectedRegionIds,
    setBasemapLayerVisible: visibility.setBasemapLayerVisible,
    setBasemapLayerColor: visibility.setBasemapLayerColor,
    setFloodLayerVisible: visibility.setFloodLayerVisible,
    setHydroBasinsVisible: visibility.setHydroBasinsVisible,
    setParcelsVisible: visibility.setParcelsVisible,
    setGasPipelineVisible: visibility.setGasPipelineVisible,
    setPowerLayerVisible: visibility.setPowerLayerVisible,
    setMarketBoundaryVisible: visibility.setMarketBoundaryVisible,
    setMarketBoundaryColorMode(
      colorMode: import("@/features/market-boundaries/market-boundaries.types").MarketBoundaryColorMode
    ): void {
      state.marketBoundaryColorMode.value = colorMode;
      state.marketBoundaryControllers.value.market?.setColorMode(colorMode);
      state.marketBoundaryControllers.value.submarket?.setColorMode(colorMode);
    },
    setWaterVisible: visibility.setWaterVisible,
    setFiberLayerVisibility: fiber.setFiberLayerVisibility,
    setFiberSourceLayerVisible: fiber.setFiberSourceLayerVisible,
    setAllFiberSourceLayers: fiber.setAllFiberSourceLayers,
    setSketchMeasureMode: state.setSketchMeasureMode,
    setSketchMeasureAreaShape: state.setSketchMeasureAreaShape,
    finishSketchMeasureArea: state.finishSketchMeasureArea,
    exportMapView: exportCurrentMapView,
    exportSelection: selectionAnalysis.exportSelection,
    openSelectionDashboard,
    exportScannerSelection: mapOverlays.exportScannerSelection,
    openScannerDashboard,
    clearSketchMeasure: state.clearSketchMeasure,
    dismissAllToolPanels: state.dismissAllToolPanels,
    useCompletedSketchAsSelection: state.useCompletedSketchAsSelection,
    clearSelection: state.clearSelectionGeometry,
    clearSelectionGeometry: state.clearSelectionGeometry,
    clearSelectedFacility: selection.clearSelectedFacility,
    navigateToFacilityDetail,
    resetMapToDefault,
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
