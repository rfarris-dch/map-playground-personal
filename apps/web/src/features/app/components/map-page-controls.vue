<script setup lang="ts">
  import { computed } from "vue";
  import MapLayerDock from "@/features/app/components/map-layer-dock.vue";
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
      shell.setQuickViewActive(false);
      shell.dismissAllToolPanels();
      shell.setSketchMeasureMode("area");
      shell.setSketchMeasureAreaShape("freeform");
    }

    shell.toggleSketchMeasurePanel();
  }
</script>

<template>
  <div class="contents" data-map-export-ignore="true">
    <MapLayerDock />

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
      @hide="shell.toggleSelectionPanel"
      @clear="shell.clearSelectionGeometry"
      @export="shell.exportSelection"
      @open-dashboard="shell.openSelectionDashboard"
      @select-facility="shell.navigateToFacilityDetail"
    />
  </div>
</template>
