<script setup lang="ts">
  import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
  import MapLayerControlsPanel from "@/features/app/components/map-layer-controls-panel.vue";
  import MapOverlayActions from "@/features/app/components/map-overlay-actions.vue";
  import type {
    MapPageControlsEmits,
    MapPageControlsProps,
  } from "@/features/app/components/map-page-controls.types";
  import MapSelectionTools from "@/features/app/components/map-selection-tools.vue";
  import MapSketchMeasureTools from "@/features/app/components/map-sketch-measure-tools.vue";
  import type { BasemapLayerId } from "@/features/basemap/basemap.types";
  import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
  import type {
    FacilitiesViewMode,
    SelectedFacilityRef,
  } from "@/features/facilities/facilities.types";
  import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
  import type { PowerLayerId } from "@/features/power/power.types";
  import type {
    SketchMeasureAreaShape,
    SketchMeasureMode,
  } from "@/features/sketch-measure/sketch-measure.types";

  const props = defineProps<MapPageControlsProps>();

  const emit = defineEmits<MapPageControlsEmits>();

  function forwardBasemapLayerVisible(layerId: BasemapLayerId, visible: boolean): void {
    emit("update:basemap-layer-visible", layerId, visible);
  }

  function forwardBoundaryVisible(boundaryId: BoundaryLayerId, visible: boolean): void {
    emit("update:boundary-visible", boundaryId, visible);
  }

  function forwardBoundarySelectedRegionIds(
    boundaryId: BoundaryLayerId,
    regionIds: readonly string[] | null
  ): void {
    emit("update:boundary-selected-region-ids", boundaryId, regionIds);
  }

  function forwardPerspectiveViewMode(
    perspective: FacilityPerspective,
    mode: FacilitiesViewMode
  ): void {
    emit("update:perspective-view-mode", perspective, mode);
  }

  function forwardPerspectiveVisibility(perspective: FacilityPerspective, visible: boolean): void {
    emit("update:perspective-visibility", perspective, visible);
  }

  function forwardParcelsVisible(visible: boolean): void {
    emit("update:parcels-visible", visible);
  }

  function forwardGasPipelineVisible(visible: boolean): void {
    emit("update:gas-pipeline-visible", visible);
  }

  function forwardWaterVisible(visible: boolean): void {
    emit("update:water-visible", visible);
  }

  function forwardFloodLayerVisible(layerId: "flood100" | "flood500", visible: boolean): void {
    emit("update:flood-layer-visible", layerId, visible);
  }

  function forwardHydroBasinsVisible(visible: boolean): void {
    emit("update:hydro-basins-visible", visible);
  }

  function forwardFiberLayerVisibility(lineId: FiberLocatorLineId, visible: boolean): void {
    emit("update:fiber-layer-visibility", lineId, visible);
  }

  function forwardFiberSourceLayer(
    lineId: FiberLocatorLineId,
    layerName: string,
    visible: boolean
  ): void {
    emit("toggle-fiber-source-layer", lineId, layerName, visible);
  }

  function forwardAllFiberSourceLayers(lineId: FiberLocatorLineId, visible: boolean): void {
    emit("set-all-fiber-source-layers", lineId, visible);
  }

  function forwardPowerLayerVisible(layerId: PowerLayerId, visible: boolean): void {
    emit("update:power-layer-visible", layerId, visible);
  }

  function forwardSketchMeasureMode(mode: SketchMeasureMode): void {
    emit("set-mode", mode);
  }

  function forwardSketchMeasureAreaShape(shape: SketchMeasureAreaShape): void {
    emit("set-area-shape", shape);
  }

  function forwardSelectedFacility(facility: SelectedFacilityRef): void {
    emit("select-facility", facility);
  }

  function handleToggleSketchMeasurePanel(): void {
    if (!props.isSketchMeasurePanelOpen && props.sketchMeasureState.mode === "off") {
      emit("set-mode", "area");
      emit("set-area-shape", "freeform");
    }

    emit("toggle-sketch-measure-panel");
  }
</script>

<template>
  <MapLayerControlsPanel
    :is-open="props.isOpen"
    :basemap-visibility="props.basemapVisibility"
    :boundary-visibility="props.boundaryVisibility"
    :boundary-facet-options="props.boundaryFacetOptions"
    :boundary-facet-selection="props.boundaryFacetSelection"
    :visible-perspectives="props.visiblePerspectives"
    :colocation-status-text="props.colocationStatusText"
    :hyperscale-status-text="props.hyperscaleStatusText"
    :parcels-visible="props.parcelsVisible"
    :parcels-status-text="props.parcelsStatusText"
    :power-visibility="props.powerVisibility"
    :flood-visibility="props.floodVisibility"
    :show-flood100-zoom-hint="props.showFlood100ZoomHint"
    :show-flood500-zoom-hint="props.showFlood500ZoomHint"
    :hydro-basins-visible="props.hydroBasinsVisible"
    :show-hydro-basins-zoom-hint="props.showHydroBasinsZoomHint"
    :gas-pipeline-visible="props.gasPipelineVisible"
    :water-visible="props.waterVisible"
    :visible-fiber-layers="props.visibleFiberLayers"
    :fiber-status-text="props.fiberStatusText"
    :fiber-source-layer-options="props.fiberSourceLayerOptions"
    :selected-fiber-source-layer-names="props.selectedFiberSourceLayerNames"
    @toggle-panel="emit('toggle-layer-panel')"
    @update:basemap-layer-visible="forwardBasemapLayerVisible"
    @update:boundary-visible="forwardBoundaryVisible"
    @update:boundary-selected-region-ids="forwardBoundarySelectedRegionIds"
    @update:perspective-view-mode="forwardPerspectiveViewMode"
    @update:perspective-visibility="forwardPerspectiveVisibility"
    @update:parcels-visible="forwardParcelsVisible"
    @update:gas-pipeline-visible="forwardGasPipelineVisible"
    @update:water-visible="forwardWaterVisible"
    @update:flood-layer-visible="forwardFloodLayerVisible"
    @update:hydro-basins-visible="forwardHydroBasinsVisible"
    @update:fiber-layer-visibility="forwardFiberLayerVisibility"
    @toggle-fiber-source-layer="forwardFiberSourceLayer"
    @set-all-fiber-source-layers="forwardAllFiberSourceLayers"
    @update:power-layer-visible="forwardPowerLayerVisible"
  />

  <MapOverlayActions
    :is-map-exporting="props.isMapExporting"
    :map-export-disabled-reason="props.mapExportDisabledReason"
    :sketch-measure-active="props.isSketchMeasurePanelOpen || props.sketchMeasureState.mode !== 'off'"
    :selection-active="props.isSelectionPanelOpen"
    :selection-disabled-reason="props.selectionDisabledReason"
    :quick-view-active="props.quickViewActive"
    :quick-view-disabled-reason="props.quickViewDisabledReason"
    :scanner-active="props.scannerActive"
    :overlays-blocked-reason="props.overlaysBlockedReason"
    @toggle-quick-view="emit('toggle-quick-view')"
    @toggle-scanner="emit('toggle-scanner')"
    @toggle-sketch-measure-panel="handleToggleSketchMeasurePanel"
    @toggle-selection-panel="emit('toggle-selection-panel')"
    @export-map-view="emit('export-map-view', $event)"
  />

  <MapSketchMeasureTools
    :is-sketch-measure-panel-open="props.isSketchMeasurePanelOpen"
    :sketch-measure-state="props.sketchMeasureState"
    @set-mode="forwardSketchMeasureMode"
    @set-area-shape="forwardSketchMeasureAreaShape"
    @finish="emit('finish')"
    @clear="emit('clear')"
    @use-as-selection="emit('use-as-selection')"
  />

  <MapSelectionTools
    :county-ids="props.countyIds"
    :is-selection-panel-open="props.isSelectionPanelOpen"
    :selection-geometry="props.selectionGeometry"
    :selection-progress="props.selectionProgress"
    :selection-summary="props.selectionSummary"
    :selection-error="props.selectionError"
    :is-loading="props.isLoading"
    @clear="emit('clear-selection')"
    @export="emit('export')"
    @open-dashboard="emit('open-dashboard')"
    @select-facility="forwardSelectedFacility"
  />
</template>
