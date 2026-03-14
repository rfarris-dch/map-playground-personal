<script setup lang="ts">
  import type { FacilityPerspective } from "@map-migration/contracts";
  import { computed, inject, ref } from "vue";
  import MapNavIcon from "@/components/icons/map-nav-icon.vue";
  import AppFilterPanel from "@/features/app/components/app-filter-panel.vue";
  import type { FilterOption } from "@/features/app/components/app-filter-panel.vue";
  import type {
    MapLayerControlsPanelEmits,
    MapLayerControlsPanelProps,
  } from "@/features/app/components/map-layer-controls-panel.types";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";
  import type { FacilityStatusFilterId } from "@/features/app/filters/map-filters.types";
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

  const mapFilters = inject(MAP_FILTERS_KEY);

  const activeTab = ref<PanelTab>("layers");
  const colocationViewMode = ref<MapNavViewModeId>("clusters");
  const hyperscaleViewMode = ref<MapNavViewModeId>("clusters");
  const fiberExpanded = ref(false);

  /* ------------------------------------------------------------------ */
  /*  Filter panel option arrays & computed props                        */
  /* ------------------------------------------------------------------ */

  const powerTypeOptions: readonly FilterOption[] = [
    { id: "commissioned", label: "Commissioned/Owned" },
    { id: "available", label: "Available (Colo Only)" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
  ];

  const statusOptions: readonly FilterOption[] = [
    { id: "commissioned", label: "Operational/Owned" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
    { id: "unknown", label: "Other" },
  ];

  const voltageOptions: readonly FilterOption[] = [
    { id: "ge-25", label: "25 kV+" },
    { id: "ge-50", label: "50 kV+" },
    { id: "ge-100", label: "100 kV+" },
    { id: "ge-230", label: "230 kV+" },
    { id: "ge-765", label: "765 kV+" },
  ];

  const gasCapacityOptions: readonly FilterOption[] = [
    { id: "0-10", label: "0 – 10 BWh" },
    { id: "25-100", label: "25 – 100 BWh" },
    { id: "100-500", label: "100 – 500 BWh" },
    { id: "500-1000", label: "500 – 1,000 BWh" },
    { id: "1000+", label: "1,000+ BWh" },
  ];

  const gasStatusOptions: readonly FilterOption[] = [
    { id: "operating", label: "Operating" },
    { id: "proposed", label: "Proposed" },
    { id: "announced", label: "Announced" },
    { id: "discontinued", label: "Discontinued" },
    { id: "in-development", label: "In Development" },
  ];

  const parcelDatasetOptions: readonly FilterOption[] = [
    { id: "", label: "All Datasets" },
  ];

  const parcelStyleOptions: readonly FilterOption[] = [
    { id: "", label: "All Sizes" },
  ];

  const parcelDavOptions: readonly FilterOption[] = [
    { id: "", label: "Any %" },
  ];

  const zoningTypeOptions: readonly FilterOption[] = [
    { id: "residential", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "industrial", label: "Industrial" },
    { id: "agriculture", label: "Agriculture" },
    { id: "exempt", label: "Exempt" },
    { id: "farmland", label: "Farmland" },
    { id: "mixed", label: "Mixed" },
    { id: "unzoned", label: "Unzoned" },
  ];

  const floodZoneOptions: readonly FilterOption[] = [
    { id: "low-risk", label: "Low Risk" },
    { id: "high-risk", label: "High Risk" },
    { id: "coastal-high-risk", label: "Coastal High Risk" },
  ];

  const marketOptions = computed<readonly FilterOption[]>(() =>
    mapFilters?.availableMarkets.value?.map((m) => ({ id: m, label: m })) ?? []
  );

  const providerOptions = computed<readonly FilterOption[]>(() =>
    mapFilters?.availableProviders.value?.map((p) => ({ id: p, label: p })) ?? []
  );

  const userOptions = computed<readonly FilterOption[]>(() => []);

  const activeVoltages = computed<ReadonlySet<string>>(() => {
    const v = mapFilters?.state.value?.transmissionMinVoltage ?? null;
    if (v === null) return new Set();
    const entry = voltageOptions.find(
      (opt) =>
        (opt.id === "ge-25" && v === 25_000) ||
        (opt.id === "ge-50" && v === 50_000) ||
        (opt.id === "ge-100" && v === 100_000) ||
        (opt.id === "ge-230" && v === 230_000) ||
        (opt.id === "ge-765" && v === 765_000)
    );
    return entry ? new Set([entry.id]) : new Set();
  });

  const parcelDropdowns = computed(() => ({
    dataset: mapFilters?.state.value?.parcelDataset ?? "",
    styleAcres: mapFilters?.state.value?.parcelStyleAcres ?? "",
    davPercent: mapFilters?.state.value?.parcelDavPercent ?? "",
  }));

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
  <Transition
    enter-active-class="transition-transform duration-200 ease-out"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-150 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="props.isOpen"
      class="pointer-events-auto absolute left-0 top-0 z-30 flex h-full w-[min(408px,calc(100vw-1rem))] flex-col overflow-hidden border-r border-border bg-card p-4 font-sans"
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
              <span class="text-xs font-normal leading-none text-foreground/70"
                >INFRASTRUCTURE</span
              >
            </div>

            <!-- Fiber Routes (expandable) -->
            <div class="flex h-10 items-center bg-card px-2 transition-colors hover:bg-background">
              <div class="flex w-full items-center justify-between">
                <button
                  type="button"
                  class="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                  @click="toggleFiberExpanded"
                >
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
                  class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                  :aria-label="`${fiberRoutesVisible ? 'Hide' : 'Show'} Fiber Routes`"
                  @click="toggleFiberRoutes"
                >
                  <MapNavIcon
                    name="eye"
                    class="h-4 w-4"
                    :class="fiberRoutesVisible ? 'text-foreground/75' : 'text-muted-foreground'"
                  />
                </button>
              </div>
            </div>

            <!-- Fiber sub-rows -->
            <div v-if="fiberExpanded" class="flex flex-col pl-4">
              <!-- Metro -->
              <div
                class="flex h-10 items-center bg-card px-2 transition-colors hover:bg-background"
              >
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
                      class="h-4 w-4"
                      :class="props.visibleFiberLayers.metro ? 'text-foreground/75' : 'text-muted-foreground'"
                    />
                  </button>
                </div>
              </div>

              <!-- Metro source layers -->
              <p
                v-if="props.fiberSourceLayerOptions.metro.length === 0 && props.visibleFiberLayers.metro"
                class="py-3 text-center text-xs text-muted-foreground animate-pulse"
              >
                Loading metro sources...
              </p>
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
                    class="flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors"
                    :class="
                    isFiberSourceLayerSelected('metro', layer.layerName)
                      ? 'border-foreground/65 bg-foreground/65'
                      : 'border-border bg-card'
                  "
                  >
                    <svg
                      v-if="isFiberSourceLayerSelected('metro', layer.layerName)"
                      aria-hidden="true"
                      class="size-2.5 text-white"
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
              <div
                class="flex h-10 items-center bg-card px-2 transition-colors hover:bg-background"
              >
                <div class="flex w-full items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="h-3 w-3 rounded-full bg-colocation" aria-hidden="true" />
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
                      class="h-4 w-4"
                      :class="props.visibleFiberLayers.longhaul ? 'text-foreground/75' : 'text-muted-foreground'"
                    />
                  </button>
                </div>
              </div>

              <!-- Longhaul source layers -->
              <p
                v-if="props.fiberSourceLayerOptions.longhaul.length === 0 && props.visibleFiberLayers.longhaul"
                class="py-3 text-center text-xs text-muted-foreground animate-pulse"
              >
                Loading longhaul sources...
              </p>
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
                    class="flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors"
                    :class="
                    isFiberSourceLayerSelected('longhaul', layer.layerName)
                      ? 'border-foreground/65 bg-foreground/65'
                      : 'border-border bg-card'
                  "
                  >
                    <svg
                      v-if="isFiberSourceLayerSelected('longhaul', layer.layerName)"
                      aria-hidden="true"
                      class="size-2.5 text-white"
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
              label="Terrain Elevation"
              :visible="props.basemapVisibility.terrain"
              @toggle="toggleBasemapLayer('terrain')"
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

        <div v-else class="flex-1 overflow-y-auto pt-2">
          <AppFilterPanel
            :power-type-options="powerTypeOptions"
            :active-power-types="mapFilters?.state.value?.powerTypes ?? new Set()"
            :status-options="statusOptions"
            :active-statuses="mapFilters?.state.value?.facilityStatuses ?? new Set()"
            :market-options="marketOptions"
            :active-markets="mapFilters?.state.value?.activeMarkets ?? new Set()"
            :provider-options="providerOptions"
            :active-providers="mapFilters?.state.value?.facilityProviders ?? new Set()"
            :user-options="userOptions"
            :active-users="mapFilters?.state.value?.activeUsers ?? new Set()"
            :interconnectivity-hub="mapFilters?.state.value?.interconnectivityHub ?? false"
            :voltage-options="voltageOptions"
            :active-voltages="activeVoltages"
            :gas-capacity-options="gasCapacityOptions"
            :active-gas-capacities="mapFilters?.state.value?.gasCapacities ?? new Set()"
            :gas-status-options="gasStatusOptions"
            :active-gas-statuses="mapFilters?.state.value?.gasStatuses ?? new Set()"
            :parcel-dataset-options="parcelDatasetOptions"
            :parcel-style-options="parcelStyleOptions"
            :parcel-dav-options="parcelDavOptions"
            :parcel-dropdowns="parcelDropdowns"
            :zoning-type-options="zoningTypeOptions"
            :active-zoning-types="mapFilters?.state.value?.zoningTypes ?? new Set()"
            :flood-zone-options="floodZoneOptions"
            :active-flood-zones="mapFilters?.state.value?.floodZones ?? new Set()"
            @toggle:power-type="mapFilters?.togglePowerType($event)"
            @toggle:status="mapFilters?.toggleFacilityStatus($event as FacilityStatusFilterId)"
            @toggle:market="mapFilters?.toggleMarket($event)"
            @toggle:provider="mapFilters?.toggleFacilityProvider($event)"
            @toggle:user="mapFilters?.toggleUser($event)"
            @update:interconnectivity-hub="mapFilters?.setInterconnectivityHub($event)"
            @toggle:voltage="mapFilters?.setTransmissionVoltage($event as any)"
            @toggle:gas-capacity="mapFilters?.toggleGasCapacity($event)"
            @toggle:gas-status="mapFilters?.toggleGasStatus($event)"
            @update:parcel-dataset="mapFilters?.setParcelDataset($event)"
            @update:parcel-style="mapFilters?.setParcelStyleAcres($event)"
            @update:parcel-dav="mapFilters?.setParcelDavPercent($event)"
            @toggle:zoning-type="mapFilters?.toggleZoningType($event)"
            @toggle:flood-zone="mapFilters?.toggleFloodZone($event)"
          />
        </div>
      </div>
    </aside>
  </Transition>
</template>
