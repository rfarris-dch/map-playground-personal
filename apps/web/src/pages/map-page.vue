<script setup lang="ts">
  import { computed } from "vue";
  import MapPageControls from "@/features/app/components/map-page-controls.vue";
  import MapPageOverlays from "@/features/app/components/map-page-overlays.vue";
  import { useAppShell } from "@/features/app/core/use-app-shell";

  const {
    mapContainer,
    map,
    selectedFacility,
    selectedParcel,
    hoveredFacility,
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
    selectionProgress,
    selectionSummary,
    selectionError,
    isSelectionLoading,
    selectionDisabledReason,
    quickViewActive,
    scannerActive,
    scannerSummary,
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
    setSketchMeasureMode,
    setSketchMeasureAreaShape,
    finishSketchMeasureArea,
    useCompletedSketchAsSelection,
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
        :basemap-visibility="basemapVisibility"
        :boundary-visibility="boundaryVisibility"
        :boundary-facet-options="boundaryFacetOptions"
        :boundary-facet-selection="boundaryFacetSelection"
        :visible-perspectives="visiblePerspectives"
        :colocation-status-text="colocationStatusText"
        :hyperscale-status-text="hyperscaleStatusText"
        :parcels-visible="parcelsVisible"
        :parcels-status-text="parcelsStatusText"
        :power-visibility="powerVisibility"
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
        :selection-disabled-reason="selectionDisabledReason"
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
        @update:perspective-visibility="setPerspectiveVisibility"
        @update:parcels-visible="setParcelsVisible"
        @update:water-visible="setWaterVisible"
        @update:fiber-layer-visibility="setFiberLayerVisibility"
        @toggle-fiber-source-layer="setFiberSourceLayerVisible"
        @set-all-fiber-source-layers="setAllFiberSourceLayers"
        @update:power-layer-visible="setPowerLayerVisible"
        @toggle-quick-view="toggleQuickView"
        @toggle-scanner="toggleScanner"
        @set-mode="setSketchMeasureMode"
        @set-area-shape="setSketchMeasureAreaShape"
        @finish="finishSketchMeasureArea"
        @clear="clearSketchMeasure"
        @use-as-selection="useCompletedSketchAsSelection"
        @clear-selection="clearSelectionGeometry"
        @export="exportSelection"
        @open-dashboard="openSelectionDashboard"
        @select-facility="selectFacilityFromAnalysis"
      />

      <MapPageOverlays
        :map="map"
        :hovered-facility="hoveredFacility"
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
        :scanner-summary="scannerSummary"
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
</style>
