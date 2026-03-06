<script setup lang="ts">
  import { PanelLeftClose, PanelLeftOpen } from "lucide-vue-next";
  import { AccordionRoot } from "reka-ui";
  import type {
    MapLayerControlsPanelEmits,
    MapLayerControlsPanelProps,
  } from "@/features/app/components/map-layer-controls-panel.types";
  import MapLayerSection from "@/features/app/components/map-layer-section.vue";
  import BasemapControls from "@/features/basemap/components/basemap-controls.vue";
  import BoundariesControls from "@/features/boundaries/components/boundaries-controls.vue";
  import FacilitiesControls from "@/features/facilities/components/facilities-controls.vue";
  import FiberLocatorControls from "@/features/fiber-locator/components/fiber-locator-controls.vue";
  import ParcelsControls from "@/features/parcels/components/parcels-controls.vue";
  import PowerControls from "@/features/power/components/power-controls.vue";
  import WaterControls from "@/features/water/components/water-controls.vue";

  const props = defineProps<MapLayerControlsPanelProps>();
  const emit = defineEmits<MapLayerControlsPanelEmits>();
</script>

<template>
  <button
    type="button"
    class="pointer-events-auto absolute left-4 top-4 z-40 inline-flex items-center gap-2 rounded-md border border-border/90 bg-card/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-sm transition hover:bg-card"
    :aria-expanded="props.isOpen"
    aria-controls="layer-controls-panel"
    :aria-label="props.isOpen ? 'Close layer controls panel' : 'Open layer controls panel'"
    @click="emit('toggle-panel')"
  >
    <PanelLeftClose v-if="props.isOpen" class="h-4 w-4" aria-hidden="true" />
    <PanelLeftOpen v-else class="h-4 w-4" aria-hidden="true" />
    Layers
  </button>

  <aside
    v-if="props.isOpen"
    id="layer-controls-panel"
    class="pointer-events-auto absolute left-4 top-16 z-30 max-h-[calc(100%-5rem)] w-[min(26rem,calc(100%-2rem))] overflow-y-auto pr-1"
    aria-label="Layer controls panel"
  >
    <AccordionRoot
      type="multiple"
      :default-value="[]"
      class="w-full overflow-hidden rounded-lg border border-border/90 bg-card/95 shadow-lg backdrop-blur-sm"
    >
      <MapLayerSection title="Basemap" value="basemap">
        <BasemapControls
          :embedded="true"
          :color-visible="props.basemapVisibility.color"
          :globe-visible="props.basemapVisibility.globe"
          :satellite-visible="props.basemapVisibility.satellite"
          :landmarks-visible="props.basemapVisibility.landmarks"
          :labels-visible="props.basemapVisibility.labels"
          :roads-visible="props.basemapVisibility.roads"
          :boundaries-visible="props.basemapVisibility.boundaries"
          :buildings3d-visible="props.basemapVisibility.buildings3d"
          @update:color-visible="emit('update:basemap-layer-visible', 'color', $event)"
          @update:globe-visible="emit('update:basemap-layer-visible', 'globe', $event)"
          @update:satellite-visible="emit('update:basemap-layer-visible', 'satellite', $event)"
          @update:landmarks-visible="emit('update:basemap-layer-visible', 'landmarks', $event)"
          @update:labels-visible="emit('update:basemap-layer-visible', 'labels', $event)"
          @update:roads-visible="emit('update:basemap-layer-visible', 'roads', $event)"
          @update:boundaries-visible="emit('update:basemap-layer-visible', 'boundaries', $event)"
          @update:buildings3d-visible="emit('update:basemap-layer-visible', 'buildings3d', $event)"
        />
      </MapLayerSection>

      <MapLayerSection title="Boundaries" value="boundaries">
        <BoundariesControls
          :embedded="true"
          :county-visible="props.boundaryVisibility.county"
          :county-facet-options="props.boundaryFacetOptions.county"
          :county-selected-region-ids="props.boundaryFacetSelection.county"
          :state-visible="props.boundaryVisibility.state"
          :state-facet-options="props.boundaryFacetOptions.state"
          :state-selected-region-ids="props.boundaryFacetSelection.state"
          :country-visible="props.boundaryVisibility.country"
          :country-facet-options="props.boundaryFacetOptions.country"
          :country-selected-region-ids="props.boundaryFacetSelection.country"
          @update:county-visible="emit('update:boundary-visible', 'county', $event)"
          @update:county-selected-region-ids="
            emit('update:boundary-selected-region-ids', 'county', $event)
          "
          @update:state-visible="emit('update:boundary-visible', 'state', $event)"
          @update:state-selected-region-ids="
            emit('update:boundary-selected-region-ids', 'state', $event)
          "
          @update:country-visible="emit('update:boundary-visible', 'country', $event)"
          @update:country-selected-region-ids="
            emit('update:boundary-selected-region-ids', 'country', $event)
          "
        />
      </MapLayerSection>

      <MapLayerSection title="Facilities" value="facilities">
        <FacilitiesControls
          :embedded="true"
          :colocation-visible="props.visiblePerspectives.colocation"
          :hyperscale-visible="props.visiblePerspectives.hyperscale"
          :colocation-status="props.colocationStatusText"
          :hyperscale-status="props.hyperscaleStatusText"
          @update:colocation-visible="emit('update:perspective-visibility', 'colocation', $event)"
          @update:hyperscale-visible="emit('update:perspective-visibility', 'hyperscale', $event)"
        />
      </MapLayerSection>

      <MapLayerSection title="Parcels" value="parcels">
        <ParcelsControls
          :embedded="true"
          :visible="props.parcelsVisible"
          :status="props.parcelsStatusText"
          @update:visible="emit('update:parcels-visible', $event)"
        />
      </MapLayerSection>

      <MapLayerSection title="Environmental" value="environmental">
        <WaterControls
          :embedded="true"
          :visible="props.waterVisible"
          @update:visible="emit('update:water-visible', $event)"
        />
      </MapLayerSection>

      <MapLayerSection title="Fiber Locator" value="fiber-locator">
        <FiberLocatorControls
          :embedded="true"
          :status="props.fiberStatusText"
          :metro-visible="props.visibleFiberLayers.metro"
          :longhaul-visible="props.visibleFiberLayers.longhaul"
          :metro-source-layers="props.fiberSourceLayerOptions.metro"
          :longhaul-source-layers="props.fiberSourceLayerOptions.longhaul"
          :selected-metro-source-layer-names="props.selectedFiberSourceLayerNames.metro"
          :selected-longhaul-source-layer-names="props.selectedFiberSourceLayerNames.longhaul"
          @update:metro-visible="emit('update:fiber-layer-visibility', 'metro', $event)"
          @update:longhaul-visible="emit('update:fiber-layer-visibility', 'longhaul', $event)"
          @toggle-source-layer="
            (lineId, layerName, visible) =>
              emit('toggle-fiber-source-layer', lineId, layerName, visible)
          "
          @set-all-source-layers="
            (lineId, visible) => emit('set-all-fiber-source-layers', lineId, visible)
          "
        />
      </MapLayerSection>

      <MapLayerSection title="Power" value="power">
        <PowerControls
          :embedded="true"
          :transmission-visible="props.powerVisibility.transmission"
          :substations-visible="props.powerVisibility.substations"
          :plants-visible="props.powerVisibility.plants"
          @update:transmission-visible="emit('update:power-layer-visible', 'transmission', $event)"
          @update:substations-visible="emit('update:power-layer-visible', 'substations', $event)"
          @update:plants-visible="emit('update:power-layer-visible', 'plants', $event)"
        />
      </MapLayerSection>
    </AccordionRoot>
  </aside>
</template>
