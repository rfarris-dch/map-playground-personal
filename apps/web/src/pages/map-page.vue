<script setup lang="ts">
  import { computed, provide } from "vue";
  import MapPageControls from "@/features/app/components/map-page-controls.vue";
  import MapPageOverlays from "@/features/app/components/map-page-overlays.vue";
  import { useAppShell } from "@/features/app/core/use-app-shell";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";

  const {
    mapFilters,
    mapContainer,
    map,
    selectedFacility,
    selectedParcel,
    hoveredFacility,
    hoveredFacilityCluster,
    hoveredBoundary,
    hoveredFiber,
    hoveredPower,
    basemapVisibility,
    boundaryVisibility,
    boundaryFacetOptions,
    boundaryFacetSelection,
    visiblePerspectives,
    colocationStatusText,
    hyperscaleStatusText,
    floodVisibility,
    showFlood100ZoomHint,
    showFlood500ZoomHint,
    hydroBasinsVisible,
    showHydroBasinsZoomHint,
    parcelsVisible,
    parcelsStatusText,
    powerVisibility,
    gasPipelineVisible,
    waterVisible,
    visibleFiberLayers,
    fiberStatusText,
    fiberSourceLayerOptions,
    selectedFiberSourceLayerNames,
    sketchMeasureState,
    selectionGeometry,
    selectionProgress,
    selectionSummary,
    selectionError,
    isSelectionLoading,
    isMapExporting,
    selectionDisabledReason,
    mapExportDisabledReason,
    quickViewActive,
    scannerActive,
    scannerSummary,
    scannerAnalysisSummary,
    scannerFacilities,
    scannerIsFiltered,
    overlaysBlockedReason,
    quickViewDisabledReason,
    scannerEmptyMessage,
    overlayStatusMessage,
    isScannerParcelsLoading,
    scannerParcelsError,
    isQuickViewVisible,
    isScannerVisible,
    isLayerPanelOpen,
    isSketchMeasurePanelOpen,
    isSelectionPanelOpen,
    facilityDetailQuery,
    parcelDetailQuery,
    setPerspectiveViewMode,
    zoomToCluster,
    setPerspectiveVisibility,
    setBoundaryVisible,
    setBoundarySelectedRegionIds,
    setBasemapLayerVisible,
    setBasemapLayerColor,
    setFloodLayerVisible,
    setHydroBasinsVisible,
    setParcelsVisible,
    setPowerLayerVisible,
    setGasPipelineVisible,
    setWaterVisible,
    setFiberLayerVisibility,
    setFiberSourceLayerVisible,
    setAllFiberSourceLayers,
    setSketchMeasureMode,
    setSketchMeasureAreaShape,
    finishSketchMeasureArea,
    useCompletedSketchAsSelection,
    exportMapView,
    exportSelection,
    exportScannerSelection,
    openSelectionDashboard,
    openScannerDashboard,
    clearSketchMeasure,
    clearSelectionGeometry,
    clearSelectedFacility,
    selectFacilityFromAnalysis,
    clearSelectedParcel,
    toggleQuickView,
    toggleScanner,
    setScannerActive,
    setQuickViewObjectCount,
    toggleLayerPanel,
    toggleSketchMeasurePanel,
    toggleSelectionPanel,
  } = useAppShell();

  provide(MAP_FILTERS_KEY, mapFilters);

  const facilityDetail = computed(() => facilityDetailQuery.data.value ?? null);
  const isFacilityDetailLoading = computed(() => facilityDetailQuery.isLoading.value);
  const isFacilityDetailError = computed(() => facilityDetailQuery.isError.value);
  const parcelDetail = computed(() => parcelDetailQuery.data.value ?? null);
  const isParcelDetailLoading = computed(() => parcelDetailQuery.isLoading.value);
  const isParcelDetailError = computed(() => parcelDetailQuery.isError.value);
</script>

<template>
  <main class="h-full w-full">
    <section
      ref="map-container"
      class="map-page-shell relative h-full w-full"
      aria-label="Map preview"
    >
      <MapPageControls
        :is-open="isLayerPanelOpen"
        :is-sketch-measure-panel-open="isSketchMeasurePanelOpen"
        :is-selection-panel-open="isSelectionPanelOpen"
        :county-ids="selectionSummary?.area.countyIds ?? []"
        :basemap-visibility="basemapVisibility"
        :boundary-visibility="boundaryVisibility"
        :boundary-facet-options="boundaryFacetOptions"
        :boundary-facet-selection="boundaryFacetSelection"
        :visible-perspectives="visiblePerspectives"
        :colocation-status-text="colocationStatusText"
        :hyperscale-status-text="hyperscaleStatusText"
        :flood-visibility="floodVisibility"
        :show-flood100-zoom-hint="showFlood100ZoomHint"
        :show-flood500-zoom-hint="showFlood500ZoomHint"
        :hydro-basins-visible="hydroBasinsVisible"
        :show-hydro-basins-zoom-hint="showHydroBasinsZoomHint"
        :parcels-visible="parcelsVisible"
        :parcels-status-text="parcelsStatusText"
        :power-visibility="powerVisibility"
        :gas-pipeline-visible="gasPipelineVisible"
        :water-visible="waterVisible"
        :visible-fiber-layers="visibleFiberLayers"
        :fiber-status-text="fiberStatusText"
        :fiber-source-layer-options="fiberSourceLayerOptions"
        :selected-fiber-source-layer-names="selectedFiberSourceLayerNames"
        :sketch-measure-state="sketchMeasureState"
        :selection-geometry="selectionGeometry"
        :selection-progress="selectionProgress"
        :selection-summary="selectionSummary"
        :selection-error="selectionError"
        :is-loading="isSelectionLoading"
        :is-map-exporting="isMapExporting"
        :selection-disabled-reason="selectionDisabledReason"
        :map-export-disabled-reason="mapExportDisabledReason"
        :quick-view-active="quickViewActive"
        :quick-view-disabled-reason="quickViewDisabledReason"
        :scanner-active="scannerActive"
        :overlays-blocked-reason="overlaysBlockedReason"
        @toggle-layer-panel="toggleLayerPanel"
        @toggle-sketch-measure-panel="toggleSketchMeasurePanel"
        @toggle-selection-panel="toggleSelectionPanel"
        @update:basemap-layer-visible="setBasemapLayerVisible"
        @update:boundary-visible="setBoundaryVisible"
        @update:boundary-selected-region-ids="setBoundarySelectedRegionIds"
        @update:perspective-view-mode="setPerspectiveViewMode"
        @update:perspective-visibility="setPerspectiveVisibility"
        @update:flood-layer-visible="setFloodLayerVisible"
        @update:hydro-basins-visible="setHydroBasinsVisible"
        @update:parcels-visible="setParcelsVisible"
        @update:gas-pipeline-visible="setGasPipelineVisible"
        @update:water-visible="setWaterVisible"
        @update:fiber-layer-visibility="setFiberLayerVisibility"
        @toggle-fiber-source-layer="setFiberSourceLayerVisible"
        @set-all-fiber-source-layers="setAllFiberSourceLayers"
        @update:power-layer-visible="setPowerLayerVisible"
        @update:basemap-layer-color="setBasemapLayerColor"
        @toggle-quick-view="toggleQuickView"
        @toggle-scanner="toggleScanner"
        @set-mode="setSketchMeasureMode"
        @set-area-shape="setSketchMeasureAreaShape"
        @finish="finishSketchMeasureArea"
        @clear="clearSketchMeasure"
        @use-as-selection="useCompletedSketchAsSelection"
        @clear-selection="clearSelectionGeometry"
        @export-map-view="exportMapView"
        @export="exportSelection"
        @open-dashboard="openSelectionDashboard"
        @select-facility="selectFacilityFromAnalysis"
      />

      <MapPageOverlays
        :county-ids="scannerAnalysisSummary.area.countyIds"
        :map="map"
        :hovered-facility="hoveredFacility"
        :hovered-facility-cluster="hoveredFacilityCluster"
        :hovered-boundary="hoveredBoundary"
        :hovered-fiber="hoveredFiber"
        :hovered-power="hoveredPower"
        :selected-facility="selectedFacility"
        :selected-parcel="selectedParcel"
        :facility-detail="facilityDetail"
        :is-facility-detail-loading="isFacilityDetailLoading"
        :is-facility-detail-error="isFacilityDetailError"
        :parcel-detail="parcelDetail"
        :is-parcel-detail-loading="isParcelDetailLoading"
        :is-parcel-detail-error="isParcelDetailError"
        :overlay-status-message="overlayStatusMessage"
        :is-quick-view-visible="isQuickViewVisible"
        :is-scanner-visible="isScannerVisible"
        :scanner-facilities="scannerFacilities"
        :scanner-summary="scannerAnalysisSummary"
        :scanner-is-filtered="scannerIsFiltered"
        :is-scanner-parcels-loading="isScannerParcelsLoading"
        :scanner-parcels-error="scannerParcelsError"
        :scanner-empty-message="scannerEmptyMessage"
        @quick-view-object-count="setQuickViewObjectCount"
        @close-scanner="setScannerActive(false)"
        @export-scanner-selection="exportScannerSelection"
        @open-scanner-dashboard="openScannerDashboard"
        @select-facility="selectFacilityFromAnalysis"
        @close-facility-detail="clearSelectedFacility"
        @close-parcel-detail="clearSelectedParcel"
        @zoom-to-cluster="zoomToCluster"
      />
    </section>
  </main>
</template>

<style>
  .map-quick-actions {
    top: 0.75rem;
    right: 0.75rem;
  }

  .map-page-shell .maplibregl-ctrl-top-right {
    top: 3.9rem;
    right: 0.75rem;
  }

  .map-page-shell .maplibregl-canvas {
    transition: filter 180ms ease;
  }
</style>
