<script setup lang="ts">
  import { computed } from "vue";
  import MapLayerControlsPanel from "@/features/app/components/map-layer-controls-panel.vue";
  import MapOverlayActions from "@/features/app/components/map-overlay-actions.vue";
  import MapSelectionTools from "@/features/app/components/map-selection-tools.vue";
  import MapSketchMeasureTools from "@/features/app/components/map-sketch-measure-tools.vue";
  import { useMapShellContext } from "@/features/app/core/map-shell-context";

  const shell = useMapShellContext();

  const sketchMeasureActive = computed(
    () => shell.isSketchMeasurePanelOpen.value || shell.sketchMeasureState.value.mode !== "off"
  );

  function handleToggleSketchMeasurePanel(): void {
    const activating = !shell.isSketchMeasurePanelOpen.value;
    if (activating) {
      shell.setScannerActive(false);
      shell.dismissAllToolPanels();
      shell.setSketchMeasureMode("area");
      shell.setSketchMeasureAreaShape("freeform");
    } else {
      shell.clearSketchMeasure();
    }

    shell.toggleSketchMeasurePanel();
  }
</script>

<template>
  <MapLayerControlsPanel
    :is-open="shell.isLayerPanelOpen.value"
    :basemap-visibility="shell.basemapVisibility.value"
    :boundary-visibility="shell.boundaryVisibility.value"
    :boundary-facet-options="shell.boundaryFacetOptions.value"
    :boundary-facet-selection="shell.boundaryFacetSelection.value"
    :visible-perspectives="shell.visiblePerspectives.value"
    :colocation-status-text="shell.colocationStatusText.value"
    :hyperscale-status-text="shell.hyperscaleStatusText.value"
    :parcels-visible="shell.parcelsVisible.value"
    :parcels-status-text="shell.parcelsStatusText.value"
    :power-visibility="shell.powerVisibility.value"
    :flood-visibility="shell.floodVisibility.value"
    :show-flood100-zoom-hint="shell.showFlood100ZoomHint.value"
    :show-flood500-zoom-hint="shell.showFlood500ZoomHint.value"
    :hydro-basins-visible="shell.hydroBasinsVisible.value"
    :show-hydro-basins-zoom-hint="shell.showHydroBasinsZoomHint.value"
    :gas-pipeline-visible="shell.gasPipelineVisible.value"
    :market-boundary-color-mode="shell.marketBoundaryColorMode.value"
    :market-boundary-visibility="shell.marketBoundaryVisibility.value"
    :water-visible="shell.waterVisible.value"
    :visible-fiber-layers="shell.visibleFiberLayers.value"
    :fiber-status-text="shell.fiberStatusText.value"
    :fiber-source-layer-options="shell.fiberSourceLayerOptions.value"
    :selected-fiber-source-layer-names="shell.selectedFiberSourceLayerNames.value"
    @toggle-panel="shell.toggleLayerPanel"
    @update:basemap-layer-visible="shell.setBasemapLayerVisible"
    @update:boundary-visible="shell.setBoundaryVisible"
    @update:boundary-selected-region-ids="shell.setBoundarySelectedRegionIds"
    @update:perspective-view-mode="shell.setPerspectiveViewMode"
    @update:perspective-visibility="shell.setPerspectiveVisibility"
    @update:parcels-visible="shell.setParcelsVisible"
    @update:gas-pipeline-visible="shell.setGasPipelineVisible"
    @update:market-boundary-visible="shell.setMarketBoundaryVisible"
    @update:market-boundary-color-mode="shell.setMarketBoundaryColorMode"
    @update:water-visible="shell.setWaterVisible"
    @update:flood-layer-visible="shell.setFloodLayerVisible"
    @update:hydro-basins-visible="shell.setHydroBasinsVisible"
    @update:fiber-layer-visibility="shell.setFiberLayerVisibility"
    @toggle-fiber-source-layer="shell.setFiberSourceLayerVisible"
    @set-all-fiber-source-layers="shell.setAllFiberSourceLayers"
    @update:power-layer-visible="shell.setPowerLayerVisible"
    @update:basemap-layer-color="shell.setBasemapLayerColor"
  />

  <MapOverlayActions
    :is-map-exporting="shell.isMapExporting.value"
    :map-export-disabled-reason="shell.mapExportDisabledReason.value"
    :sketch-measure-active="sketchMeasureActive"
    :selection-active="shell.isSelectionPanelOpen.value"
    :selection-disabled-reason="shell.selectionDisabledReason.value"
    :quick-view-active="shell.quickViewActive.value"
    :quick-view-disabled-reason="shell.quickViewDisabledReason.value"
    :scanner-active="shell.scannerActive.value"
    :overlays-blocked-reason="shell.overlaysBlockedReason.value"
    @toggle-quick-view="shell.toggleQuickView"
    @toggle-scanner="shell.toggleScanner"
    @toggle-sketch-measure-panel="handleToggleSketchMeasurePanel"
    @toggle-selection-panel="shell.toggleSelectionPanel"
    @export-map-view="shell.exportMapView"
  />

  <MapSketchMeasureTools
    :is-sketch-measure-panel-open="shell.isSketchMeasurePanelOpen.value"
    :sketch-measure-state="shell.sketchMeasureState.value"
    @set-mode="shell.setSketchMeasureMode"
    @set-area-shape="shell.setSketchMeasureAreaShape"
    @finish="shell.finishSketchMeasureArea"
    @clear="shell.clearSketchMeasure"
    @use-as-selection="shell.useCompletedSketchAsSelection"
  />

  <MapSelectionTools
    :county-ids="shell.selectionSummary.value?.area.countyIds ?? []"
    :is-selection-panel-open="shell.isSelectionPanelOpen.value"
    :selection-geometry="shell.selectionGeometry.value"
    :selection-progress="shell.selectionProgress.value"
    :selection-summary="shell.selectionSummary.value"
    :selection-error="shell.selectionError.value"
    :is-loading="shell.isSelectionLoading.value"
    @clear="shell.clearSelectionGeometry"
    @export="shell.exportSelection"
    @open-dashboard="shell.openSelectionDashboard"
    @select-facility="shell.selectFacilityFromAnalysis"
  />
</template>
