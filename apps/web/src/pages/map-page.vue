<script setup lang="ts">
  import {
    ChevronDown,
    Eye,
    EyeOff,
    PanelLeftClose,
    PanelLeftOpen,
    ScanSearch,
  } from "lucide-vue-next";
  import {
    AccordionContent,
    AccordionHeader,
    AccordionItem,
    AccordionRoot,
    AccordionTrigger,
  } from "reka-ui";
  import Button from "@/components/ui/button/button.vue";
  import { useAppShell } from "@/features/app/use-app-shell";
  import BasemapControls from "@/features/basemap/components/basemap-controls.vue";
  import BoundariesControls from "@/features/boundaries/components/boundaries-controls.vue";
  import BoundaryHoverTooltip from "@/features/boundaries/components/boundary-hover-tooltip.vue";
  import FacilitiesControls from "@/features/facilities/components/facilities-controls.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import FacilityDetailDrawer from "@/features/facilities/facility-detail/components/facility-detail-drawer.vue";
  import FiberLocatorControls from "@/features/fiber-locator/components/fiber-locator-controls.vue";
  import FiberLocatorHoverTooltip from "@/features/fiber-locator/components/fiber-locator-hover-tooltip.vue";
  import MeasureAnalysisPanel from "@/features/measure/components/measure-analysis-panel.vue";
  import MeasureToolbar from "@/features/measure/components/measure-toolbar.vue";
  import ParcelsControls from "@/features/parcels/components/parcels-controls.vue";
  import ParcelDetailDrawer from "@/features/parcels/parcel-detail/components/parcel-detail-drawer.vue";
  import PowerControls from "@/features/power/components/power-controls.vue";
  import PowerHoverTooltip from "@/features/power/components/power-hover-tooltip.vue";
  import QuickViewOverlay from "@/features/quick-view/components/quick-view-overlay.vue";
  import ScannerPanel from "@/features/scanner/components/scanner-panel.vue";

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
    visibleFiberLayers,
    fiberStatusText,
    fiberSourceLayerOptions,
    selectedFiberSourceLayerNames,
    measureState,
    measureSelectionSummary,
    measureSelectionError,
    isMeasureSelectionLoading,
    quickViewActive,
    scannerActive,
    scannerSummary,
    scannerFacilities,
    scannerTotalCount,
    scannerIsFiltered,
    isScannerParcelsLoading,
    scannerParcelsError,
    isQuickViewVisible,
    isScannerVisible,
    isQuickViewDensityOk,
    isLayerPanelOpen,
    isMeasurePanelOpen,
    facilityDetailQuery,
    parcelDetailQuery,
    setPerspectiveVisibility,
    setBoundaryVisible,
    setBoundarySelectedRegionIds,
    setBasemapLayerVisible,
    setParcelsVisible,
    setPowerLayerVisible,
    setFiberLayerVisibility,
    setFiberSourceLayerVisible,
    setAllFiberSourceLayers,
    setMeasureMode,
    setMeasureAreaShape,
    finishMeasureSelection,
    exportMeasureSelection,
    exportScannerSelection,
    clearMeasure,
    clearSelectedFacility,
    selectFacilityFromAnalysis,
    clearSelectedParcel,
    toggleQuickView,
    toggleScanner,
    setScannerActive,
    setQuickViewObjectCount,
    toggleLayerPanel,
    toggleMeasurePanel,
  } = useAppShell();
</script>

<template>
  <main class="h-full w-full">
    <section
      ref="map-container"
      class="map-page-shell relative h-full w-full"
      aria-label="Map preview"
    >
      <button
        type="button"
        class="pointer-events-auto absolute left-4 top-4 z-40 inline-flex items-center gap-2 rounded-md border border-border/90 bg-card/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-sm transition hover:bg-card"
        :aria-expanded="isLayerPanelOpen"
        aria-controls="layer-controls-panel"
        :aria-label="isLayerPanelOpen ? 'Close layer controls panel' : 'Open layer controls panel'"
        @click="toggleLayerPanel"
      >
        <PanelLeftClose v-if="isLayerPanelOpen" class="h-4 w-4" aria-hidden="true" />
        <PanelLeftOpen v-else class="h-4 w-4" aria-hidden="true" />
        Layers
      </button>

      <aside
        v-if="isLayerPanelOpen"
        id="layer-controls-panel"
        class="pointer-events-auto absolute left-4 top-16 z-30 max-h-[calc(100%-5rem)] w-[min(26rem,calc(100%-2rem))] overflow-y-auto pr-1"
        aria-label="Layer controls panel"
      >
        <AccordionRoot
          type="multiple"
          :default-value="[]"
          class="w-full overflow-hidden rounded-lg border border-border/90 bg-card/95 shadow-lg backdrop-blur-sm"
        >
          <AccordionItem value="basemap" class="border-b border-border/70 last:border-b-0">
            <AccordionHeader>
              <AccordionTrigger
                class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
              >
                Basemap
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  aria-hidden="true"
                />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="px-3 pb-3 pt-1">
              <BasemapControls
                :embedded="true"
                :satellite-visible="basemapVisibility.satellite"
                :landmarks-visible="basemapVisibility.landmarks"
                :labels-visible="basemapVisibility.labels"
                :roads-visible="basemapVisibility.roads"
                :boundaries-visible="basemapVisibility.boundaries"
                :buildings3d-visible="basemapVisibility.buildings3d"
                @update:satellite-visible="setBasemapLayerVisible('satellite', $event)"
                @update:landmarks-visible="setBasemapLayerVisible('landmarks', $event)"
                @update:labels-visible="setBasemapLayerVisible('labels', $event)"
                @update:roads-visible="setBasemapLayerVisible('roads', $event)"
                @update:boundaries-visible="setBasemapLayerVisible('boundaries', $event)"
                @update:buildings3d-visible="setBasemapLayerVisible('buildings3d', $event)"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="boundaries" class="border-b border-border/70 last:border-b-0">
            <AccordionHeader>
              <AccordionTrigger
                class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
              >
                Boundaries
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  aria-hidden="true"
                />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="px-3 pb-3 pt-1">
              <BoundariesControls
                :embedded="true"
                :county-visible="boundaryVisibility.county"
                :county-facet-options="boundaryFacetOptions.county"
                :county-selected-region-ids="boundaryFacetSelection.county"
                :state-visible="boundaryVisibility.state"
                :state-facet-options="boundaryFacetOptions.state"
                :state-selected-region-ids="boundaryFacetSelection.state"
                :country-visible="boundaryVisibility.country"
                :country-facet-options="boundaryFacetOptions.country"
                :country-selected-region-ids="boundaryFacetSelection.country"
                @update:county-visible="setBoundaryVisible('county', $event)"
                @update:county-selected-region-ids="setBoundarySelectedRegionIds('county', $event)"
                @update:state-visible="setBoundaryVisible('state', $event)"
                @update:state-selected-region-ids="setBoundarySelectedRegionIds('state', $event)"
                @update:country-visible="setBoundaryVisible('country', $event)"
                @update:country-selected-region-ids="setBoundarySelectedRegionIds('country', $event)"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="facilities" class="border-b border-border/70 last:border-b-0">
            <AccordionHeader>
              <AccordionTrigger
                class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
              >
                Facilities
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  aria-hidden="true"
                />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="px-3 pb-3 pt-1">
              <FacilitiesControls
                :embedded="true"
                :colocation-visible="visiblePerspectives.colocation"
                :hyperscale-visible="visiblePerspectives.hyperscale"
                :colocation-status="colocationStatusText"
                :hyperscale-status="hyperscaleStatusText"
                @update:colocation-visible="setPerspectiveVisibility('colocation', $event)"
                @update:hyperscale-visible="setPerspectiveVisibility('hyperscale', $event)"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="parcels" class="border-b border-border/70 last:border-b-0">
            <AccordionHeader>
              <AccordionTrigger
                class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
              >
                Parcels
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  aria-hidden="true"
                />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="px-3 pb-3 pt-1">
              <ParcelsControls
                :embedded="true"
                :visible="parcelsVisible"
                :status="parcelsStatusText"
                @update:visible="setParcelsVisible"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="fiber-locator" class="border-b border-border/70 last:border-b-0">
            <AccordionHeader>
              <AccordionTrigger
                class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
              >
                Fiber Locator
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  aria-hidden="true"
                />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="px-3 pb-3 pt-1">
              <FiberLocatorControls
                :embedded="true"
                :status="fiberStatusText"
                :metro-visible="visibleFiberLayers.metro"
                :longhaul-visible="visibleFiberLayers.longhaul"
                :metro-source-layers="fiberSourceLayerOptions.metro"
                :longhaul-source-layers="fiberSourceLayerOptions.longhaul"
                :selected-metro-source-layer-names="selectedFiberSourceLayerNames.metro"
                :selected-longhaul-source-layer-names="selectedFiberSourceLayerNames.longhaul"
                @update:metro-visible="setFiberLayerVisibility('metro', $event)"
                @update:longhaul-visible="setFiberLayerVisibility('longhaul', $event)"
                @toggle-source-layer="setFiberSourceLayerVisible"
                @set-all-source-layers="setAllFiberSourceLayers"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="power" class="border-b border-border/70 last:border-b-0">
            <AccordionHeader>
              <AccordionTrigger
                class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide transition hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180"
              >
                Power
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  aria-hidden="true"
                />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="px-3 pb-3 pt-1">
              <PowerControls
                :embedded="true"
                :transmission-visible="powerVisibility.transmission"
                :substations-visible="powerVisibility.substations"
                :plants-visible="powerVisibility.plants"
                @update:transmission-visible="setPowerLayerVisible('transmission', $event)"
                @update:substations-visible="setPowerLayerVisible('substations', $event)"
                @update:plants-visible="setPowerLayerVisible('plants', $event)"
              />
            </AccordionContent>
          </AccordionItem>
        </AccordionRoot>
      </aside>

      <div class="map-quick-actions pointer-events-auto absolute z-40 flex gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          :disabled="scannerTotalCount === 0"
          :class="
            quickViewActive
              ? 'border border-cyan-500/30 bg-cyan-500/10 shadow-lg backdrop-blur-sm'
              : 'border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm'
          "
          @click="toggleQuickView"
        >
          <EyeOff v-if="quickViewActive" class="mr-1.5 h-3.5 w-3.5" />
          <Eye v-else class="mr-1.5 h-3.5 w-3.5" />
          Quick View
          <span class="ml-1 text-[10px] text-muted-foreground">(G)</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          :class="
            scannerActive
              ? 'border border-cyan-500/30 bg-cyan-500/10 shadow-lg backdrop-blur-sm'
              : 'border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm'
          "
          @click="toggleScanner"
        >
          <ScanSearch class="mr-1.5 h-3.5 w-3.5" />
          Scanner
          <span class="ml-1 text-[10px] text-muted-foreground">(V)</span>
        </Button>
      </div>

      <button
        type="button"
        class="pointer-events-auto absolute bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-md border border-border/90 bg-card/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-sm transition hover:bg-card"
        :aria-expanded="isMeasurePanelOpen"
        aria-controls="measure-tools-panel"
        :aria-label="isMeasurePanelOpen ? 'Close measurement tools panel' : 'Open measurement tools panel'"
        @click="toggleMeasurePanel"
      >
        <PanelLeftClose v-if="isMeasurePanelOpen" class="h-4 w-4" aria-hidden="true" />
        <PanelLeftOpen v-else class="h-4 w-4" aria-hidden="true" />
        Measure
      </button>

      <MeasureToolbar
        v-if="isMeasurePanelOpen"
        id="measure-tools-panel"
        :state="measureState"
        @set-mode="setMeasureMode"
        @set-area-shape="setMeasureAreaShape"
        @finish="finishMeasureSelection"
        @clear="clearMeasure"
      />

      <MeasureAnalysisPanel
        v-if="measureState.selectionRing !== null"
        :summary="measureSelectionSummary"
        :error-message="measureSelectionError"
        :is-loading="isMeasureSelectionLoading"
        @clear="clearMeasure"
        @export="exportMeasureSelection"
        @select-facility="selectFacilityFromAnalysis"
      />

      <QuickViewOverlay
        v-if="isQuickViewVisible"
        :active="isQuickViewVisible"
        :facilities="scannerFacilities"
        :map="map"
        :density-limit="15"
        @object-count="setQuickViewObjectCount"
      />

      <ScannerPanel
        v-if="isScannerVisible"
        :summary="scannerSummary"
        :is-filtered="scannerIsFiltered"
        :is-parcels-loading="isScannerParcelsLoading"
        :parcels-error-message="scannerParcelsError"
        @close="setScannerActive(false)"
        @export="exportScannerSelection"
        @select-facility="selectFacilityFromAnalysis"
      />

      <div
        class="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur-sm"
      >
        Esc clears drawing/selection, then Scanner, then Quick View
        <span v-if="quickViewActive && !isQuickViewDensityOk">
          · showing largest facilities only</span
        >
        <span v-else-if="scannerTotalCount === 0"> · no facilities in current viewport</span>
      </div>

      <FacilityHoverTooltip :hover-state="hoveredFacility" />
      <BoundaryHoverTooltip :hover-state="hoveredBoundary" />
      <FiberLocatorHoverTooltip :hover-state="hoveredFiber" />
      <PowerHoverTooltip :hover-state="hoveredPower" />

      <FacilityDetailDrawer
        :selected-facility="selectedFacility"
        :detail="facilityDetailQuery.data.value ?? null"
        :is-loading="facilityDetailQuery.isLoading.value"
        :is-error="facilityDetailQuery.isError.value"
        @close="clearSelectedFacility"
      />

      <ParcelDetailDrawer
        :selected-parcel="selectedParcel"
        :detail="parcelDetailQuery.data.value ?? null"
        :is-loading="parcelDetailQuery.isLoading.value"
        :is-error="parcelDetailQuery.isError.value"
        @close="clearSelectedParcel"
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
