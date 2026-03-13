<script setup lang="ts">
  import type { FacilityPerspective } from "@map-migration/contracts";
  import { computed, ref } from "vue";
  import MapNavIcon from "@/components/icons/map-nav-icon.vue";
  import MapFilterControls from "@/features/app/components/map-filter-controls.vue";
  import type {
    MapLayerControlsPanelEmits,
    MapLayerControlsPanelProps,
  } from "@/features/app/components/map-layer-controls-panel.types";
  import type { MapNavViewModeId } from "@/features/app/components/map-nav.types";
  import MapNavLayerRow from "@/features/app/components/map-nav-layer-row.vue";
  import MapNavViewModes from "@/features/app/components/map-nav-view-modes.vue";
  import type { BasemapLayerId } from "@/features/basemap/basemap.types";
  import type { FacilitiesViewMode } from "@/features/facilities/facilities.types";
  import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
  import type { PowerLayerId } from "@/features/power/power.types";

  type PanelTab = "layers" | "filters";

  const props = defineProps<MapLayerControlsPanelProps>();
  const emit = defineEmits<MapLayerControlsPanelEmits>();

  const activeTab = ref<PanelTab>("layers");
  const colocationViewMode = ref<MapNavViewModeId>("clusters");
  const hyperscaleViewMode = ref<MapNavViewModeId>("clusters");
  const fiberExpanded = ref(false);

  const fiberRoutesVisible = computed(
    () => props.visibleFiberLayers.longhaul || props.visibleFiberLayers.metro
  );

  function togglePanel(): void {
    emit("toggle-panel");
  }

  function openAs(tab: PanelTab): void {
    activeTab.value = tab;
    emit("toggle-panel");
  }

  function togglePerspectiveVisibility(perspective: FacilityPerspective): void {
    emit("update:perspective-visibility", perspective, !props.visiblePerspectives[perspective]);
  }

  function setFiberRoutesVisible(visible: boolean): void {
    const lineIds: readonly FiberLocatorLineId[] = ["metro", "longhaul"];
    for (const lineId of lineIds) {
      emit("update:fiber-layer-visibility", lineId, visible);
    }
  }

  function toggleFiberRoutes(): void {
    setFiberRoutesVisible(!fiberRoutesVisible.value);
  }

  function toggleFiberExpanded(): void {
    fiberExpanded.value = !fiberExpanded.value;
  }

  function toggleFiberLine(lineId: FiberLocatorLineId): void {
    emit("update:fiber-layer-visibility", lineId, !props.visibleFiberLayers[lineId]);
  }

  function toggleFiberSourceLayer(lineId: FiberLocatorLineId, layerName: string): void {
    const selected =
      lineId === "metro"
        ? props.selectedFiberSourceLayerNames.metro
        : props.selectedFiberSourceLayerNames.longhaul;
    const isSelected = selected.some((n) => n.toLowerCase() === layerName.toLowerCase());
    emit("toggle-fiber-source-layer", lineId, layerName, !isSelected);
  }

  function isFiberSourceLayerSelected(lineId: FiberLocatorLineId, layerName: string): boolean {
    const selected =
      lineId === "metro"
        ? props.selectedFiberSourceLayerNames.metro
        : props.selectedFiberSourceLayerNames.longhaul;
    return selected.some((n) => n.toLowerCase() === layerName.toLowerCase());
  }

  function togglePowerLayer(layerId: PowerLayerId): void {
    emit("update:power-layer-visible", layerId, !props.powerVisibility[layerId]);
  }

  function toggleParcels(): void {
    emit("update:parcels-visible", !props.parcelsVisible);
  }

  function setColocationViewMode(mode: MapNavViewModeId): void {
    colocationViewMode.value = mode;
    emit("update:perspective-view-mode", "colocation", mode as FacilitiesViewMode);
  }

  function setHyperscaleViewMode(mode: MapNavViewModeId): void {
    hyperscaleViewMode.value = mode;
    emit("update:perspective-view-mode", "hyperscale", mode as FacilitiesViewMode);
  }

  function toggleBasemapLayer(layerId: BasemapLayerId): void {
    emit("update:basemap-layer-visible", layerId, !props.basemapVisibility[layerId]);
  }
</script>

<template>
  <!-- Collapsed sidebar -->
  <nav
    v-if="!props.isOpen"
    class="pointer-events-auto absolute left-0 top-0 z-30 flex h-full flex-col items-start border-r border-border bg-card px-2 py-4 font-sans"
    aria-label="Map navigation"
  >
    <button
      type="button"
      class="flex items-center gap-1 rounded-sm p-2 text-foreground/70 transition-colors hover:bg-background hover:text-foreground/75"
      aria-label="Open layers panel"
      @click="openAs('layers')"
    >
      <span class="flex size-6 items-center justify-center">
        <MapNavIcon name="layers" class="h-[14px] w-4" />
      </span>
      <span class="flex size-4 items-center justify-center">
        <MapNavIcon name="chevron-left" class="h-2 w-[5px]" />
      </span>
    </button>

    <button
      type="button"
      class="flex items-center gap-1 rounded-sm p-2 text-foreground/70 transition-colors hover:bg-background hover:text-foreground/75"
      aria-label="Open filters panel"
      @click="openAs('filters')"
    >
      <span class="flex size-6 items-center justify-center">
        <MapNavIcon name="filter" class="h-[14px] w-[14px]" />
      </span>
      <span class="flex size-4 items-center justify-center">
        <MapNavIcon name="chevron-left" class="h-2 w-[5px]" />
      </span>
    </button>
  </nav>

  <!-- Expanded sidebar -->
  <aside
    v-else
    class="pointer-events-auto absolute left-0 top-0 z-30 flex h-full w-[min(408px,100vw)] flex-col overflow-hidden border-r border-border bg-card p-4 font-sans"
    aria-label="Map layers panel"
  >
    <div class="flex h-full flex-col">
      <header class="flex h-10 items-center justify-between bg-card px-2">
        <div class="flex items-center gap-2">
          <span class="flex size-6 items-center justify-center text-foreground/85">
            <MapNavIcon
              :name="activeTab === 'layers' ? 'layers' : 'filter'"
              :class="activeTab === 'layers' ? 'h-[14px] w-4' : 'h-[14px] w-[14px]'"
            />
          </span>
          <span class="text-sm font-medium leading-none text-foreground/85">
            {{ activeTab === 'layers' ? 'Layers' : 'Filters' }}
          </span>
        </div>

        <button
          type="button"
          class="flex size-4 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-background hover:text-foreground/75"
          aria-label="Collapse panel"
          @click="togglePanel"
        >
          <MapNavIcon name="chevron-left" class="h-2 w-[5px] rotate-180" />
        </button>
      </header>

      <div class="h-px w-full bg-border" />

      <div v-if="activeTab === 'layers'" class="flex-1 overflow-y-auto pt-2">
        <section class="flex flex-col">
          <div class="flex h-7 items-center bg-card px-2">
            <span class="text-xs font-normal leading-none text-foreground/70">FACILITIES</span>
          </div>

          <MapNavLayerRow
            label="Colocation"
            :visible="props.visiblePerspectives.colocation"
            @toggle="togglePerspectiveVisibility('colocation')"
          />
          <MapNavViewModes
            :active-mode="colocationViewMode"
            @update:active-mode="setColocationViewMode"
          />

          <MapNavLayerRow
            label="Hyperscale"
            :visible="props.visiblePerspectives.hyperscale"
            @toggle="togglePerspectiveVisibility('hyperscale')"
          />
          <MapNavViewModes
            :active-mode="hyperscaleViewMode"
            @update:active-mode="setHyperscaleViewMode"
          />

          <MapNavLayerRow label="Hyperscale Leased" :actionable="false" :visible="true" />
        </section>

        <div class="my-0 h-px w-full bg-border" />

        <section class="flex flex-col">
          <div class="flex h-7 items-center bg-card px-2">
            <span class="text-xs font-normal leading-none text-foreground/70">INFRASTRUCTURE</span>
          </div>

          <!-- Fiber Routes (expandable) -->
          <div class="flex h-10 items-center bg-card px-2 transition-colors hover:bg-background">
            <div class="flex w-full items-center justify-between">
              <button type="button" class="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none" @click="toggleFiberExpanded">
                <svg
                  class="h-[5px] w-2 text-foreground/70 transition-transform"
                  :class="fiberExpanded ? 'rotate-180' : 'rotate-90'"
                  width="8"
                  height="5"
                  viewBox="0 0 8 5"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0.75 3.75L4 0.75L7.25 3.75"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="h-3 w-3 rounded-full bg-muted" aria-hidden="true" />
                <span
                  class="text-sm font-medium leading-none"
                  :class="fiberRoutesVisible ? 'text-foreground/85' : 'text-foreground/70'"
                  >Fiber Routes</span
                >
              </button>

              <button
                type="button"
                class="flex size-6 items-center justify-center rounded-sm transition-colors hover:bg-background"
                :aria-label="`${fiberRoutesVisible ? 'Hide' : 'Show'} Fiber Routes`"
                @click="toggleFiberRoutes"
              >
                <MapNavIcon
                  name="eye"
                  class="h-[9.672px] w-4"
                  :class="fiberRoutesVisible ? 'text-foreground/75' : 'text-muted-foreground'"
                />
              </button>
            </div>
          </div>

          <!-- Fiber sub-rows -->
          <div v-if="fiberExpanded" class="flex flex-col pl-4">
            <!-- Metro -->
            <div class="flex h-10 items-center bg-card px-2 transition-colors hover:bg-background">
              <div class="flex w-full items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="h-3 w-3 rounded-full bg-pink-500" aria-hidden="true" />
                  <span
                    class="text-sm font-medium leading-none"
                    :class="props.visibleFiberLayers.metro ? 'text-foreground/85' : 'text-foreground/70'"
                    >Metro</span
                  >
                </div>
                <button
                  type="button"
                  class="flex size-6 items-center justify-center rounded-sm transition-colors hover:bg-background"
                  :aria-label="`${props.visibleFiberLayers.metro ? 'Hide' : 'Show'} Metro`"
                  @click="toggleFiberLine('metro')"
                >
                  <MapNavIcon
                    name="eye"
                    class="h-[9.672px] w-4"
                    :class="props.visibleFiberLayers.metro ? 'text-foreground/75' : 'text-muted-foreground'"
                  />
                </button>
              </div>
            </div>

            <!-- Metro source layers -->
            <div
              v-if="props.fiberSourceLayerOptions.metro.length > 0 && props.visibleFiberLayers.metro"
              class="flex flex-col gap-0.5 px-2 py-1 pl-7"
            >
              <label
                v-for="layer in props.fiberSourceLayerOptions.metro"
                :key="layer.layerName"
                class="flex h-7 cursor-pointer items-center gap-2 rounded-sm px-1 transition-colors hover:bg-background"
              >
                <span
                  class="flex size-[14px] shrink-0 items-center justify-center rounded-sm border transition-colors"
                  :class="
                    isFiberSourceLayerSelected('metro', layer.layerName)
                      ? 'border-foreground/65 bg-foreground/65'
                      : 'border-border bg-white'
                  "
                >
                  <svg
                    v-if="isFiberSourceLayerSelected('metro', layer.layerName)"
                    class="size-[10px] text-white"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span
                  v-if="layer.color"
                  class="h-[3px] w-3 rounded-full"
                  :style="{ backgroundColor: layer.color }"
                  aria-hidden="true"
                />
                <span
                  class="min-w-0 flex-1 truncate text-xs leading-none"
                  :class="isFiberSourceLayerSelected('metro', layer.layerName) ? 'text-foreground/70' : 'text-foreground/70'"
                  >{{ layer.label }}</span
                >
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="isFiberSourceLayerSelected('metro', layer.layerName)"
                  @change="toggleFiberSourceLayer('metro', layer.layerName)"
                >
              </label>
            </div>

            <!-- Longhaul -->
            <div class="flex h-10 items-center bg-card px-2 transition-colors hover:bg-background">
              <div class="flex w-full items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="h-3 w-3 rounded-full bg-cyan-500" aria-hidden="true" />
                  <span
                    class="text-sm font-medium leading-none"
                    :class="props.visibleFiberLayers.longhaul ? 'text-foreground/85' : 'text-foreground/70'"
                    >Longhaul</span
                  >
                </div>
                <button
                  type="button"
                  class="flex size-6 items-center justify-center rounded-sm transition-colors hover:bg-background"
                  :aria-label="`${props.visibleFiberLayers.longhaul ? 'Hide' : 'Show'} Longhaul`"
                  @click="toggleFiberLine('longhaul')"
                >
                  <MapNavIcon
                    name="eye"
                    class="h-[9.672px] w-4"
                    :class="props.visibleFiberLayers.longhaul ? 'text-foreground/75' : 'text-muted-foreground'"
                  />
                </button>
              </div>
            </div>

            <!-- Longhaul source layers -->
            <div
              v-if="props.fiberSourceLayerOptions.longhaul.length > 0 && props.visibleFiberLayers.longhaul"
              class="flex flex-col gap-0.5 px-2 py-1 pl-7"
            >
              <label
                v-for="layer in props.fiberSourceLayerOptions.longhaul"
                :key="layer.layerName"
                class="flex h-7 cursor-pointer items-center gap-2 rounded-sm px-1 transition-colors hover:bg-background"
              >
                <span
                  class="flex size-[14px] shrink-0 items-center justify-center rounded-sm border transition-colors"
                  :class="
                    isFiberSourceLayerSelected('longhaul', layer.layerName)
                      ? 'border-foreground/65 bg-foreground/65'
                      : 'border-border bg-white'
                  "
                >
                  <svg
                    v-if="isFiberSourceLayerSelected('longhaul', layer.layerName)"
                    class="size-[10px] text-white"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span
                  v-if="layer.color"
                  class="h-[3px] w-3 rounded-full"
                  :style="{ backgroundColor: layer.color }"
                  aria-hidden="true"
                />
                <span
                  class="min-w-0 flex-1 truncate text-xs leading-none"
                  :class="isFiberSourceLayerSelected('longhaul', layer.layerName) ? 'text-foreground/70' : 'text-foreground/70'"
                  >{{ layer.label }}</span
                >
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="isFiberSourceLayerSelected('longhaul', layer.layerName)"
                  @change="toggleFiberSourceLayer('longhaul', layer.layerName)"
                >
              </label>
            </div>
          </div>
          <MapNavLayerRow
            label="Substations"
            :visible="props.powerVisibility.substations"
            @toggle="togglePowerLayer('substations')"
          />
          <MapNavLayerRow
            label="Power Plants"
            :visible="props.powerVisibility.plants"
            @toggle="togglePowerLayer('plants')"
          />
          <MapNavLayerRow
            label="Transmission Lines"
            :visible="props.powerVisibility.transmission"
            @toggle="togglePowerLayer('transmission')"
          />
          <MapNavLayerRow label="Natural Gas Pipelines" :actionable="false" :visible="true" />
          <MapNavLayerRow
            label="US Parcels"
            :visible="props.parcelsVisible"
            @toggle="toggleParcels"
          />
        </section>

        <div class="my-0 h-px w-full bg-border" />

        <section class="flex flex-col">
          <div class="flex h-7 items-center bg-card px-2">
            <span class="text-xs font-normal leading-none text-foreground/70">ENVIRONMENTAL</span>
          </div>

          <MapNavLayerRow
            label="Flood Zones (100yr)"
            :visible="props.floodVisibility.flood100"
            @toggle="emit('update:flood-layer-visible', 'flood100', !props.floodVisibility.flood100)"
          />
          <MapNavLayerRow
            label="Flood Zones (500yr)"
            :visible="props.floodVisibility.flood500"
            @toggle="emit('update:flood-layer-visible', 'flood500', !props.floodVisibility.flood500)"
          />
          <MapNavLayerRow
            label="Hydro Basins"
            :visible="props.hydroBasinsVisible"
            @toggle="emit('update:hydro-basins-visible', !props.hydroBasinsVisible)"
          />
          <MapNavLayerRow
            label="Water Features"
            :visible="props.waterVisible"
            @toggle="emit('update:water-visible', !props.waterVisible)"
          />
        </section>

        <div class="my-0 h-px w-full bg-border" />

        <section class="flex flex-col pb-4">
          <div class="flex h-7 items-center bg-card px-2">
            <span class="text-xs font-normal leading-none text-foreground/70">BASEMAP</span>
          </div>

          <MapNavLayerRow
            label="Color Map"
            :visible="props.basemapVisibility.color"
            @toggle="toggleBasemapLayer('color')"
          />
          <MapNavLayerRow
            label="Globe Projection"
            :visible="props.basemapVisibility.globe"
            @toggle="toggleBasemapLayer('globe')"
          />
          <MapNavLayerRow
            label="Satellite Imagery"
            :visible="props.basemapVisibility.satellite"
            @toggle="toggleBasemapLayer('satellite')"
          />
          <MapNavLayerRow
            label="3D Buildings"
            :visible="props.basemapVisibility.buildings3d"
            @toggle="toggleBasemapLayer('buildings3d')"
          />
          <MapNavLayerRow
            label="Labels"
            :visible="props.basemapVisibility.labels"
            @toggle="toggleBasemapLayer('labels')"
          />
          <MapNavLayerRow
            label="Roads"
            :visible="props.basemapVisibility.roads"
            @toggle="toggleBasemapLayer('roads')"
          />
          <MapNavLayerRow
            label="Boundaries"
            :visible="props.basemapVisibility.boundaries"
            @toggle="toggleBasemapLayer('boundaries')"
          />
          <MapNavLayerRow
            label="Landmarks"
            :visible="props.basemapVisibility.landmarks"
            @toggle="toggleBasemapLayer('landmarks')"
          />
        </section>
      </div>

      <div v-else class="flex-1 overflow-y-auto pt-2"><MapFilterControls /></div>
    </div>
  </aside>
</template>
