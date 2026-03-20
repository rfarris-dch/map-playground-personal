<script setup lang="ts">
  import {
    computed,
    inject,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
  } from "vue";
  import MapNavIcon from "@/components/icons/map-nav-icon.vue";
  import Switch from "@/components/ui/switch/switch.vue";
  import { useGsapStagger } from "@/composables/use-gsap-stagger";
  import { useGsapTransition } from "@/composables/use-gsap-transition";
  import DockFlyoutBasemap from "@/features/app/components/dock-flyout-basemap.vue";
  import DockFlyoutFacilities from "@/features/app/components/dock-flyout-facilities.vue";
  import DockFlyoutFiber from "@/features/app/components/dock-flyout-fiber.vue";
  import DockFlyoutGas from "@/features/app/components/dock-flyout-gas.vue";
  import DockFlyoutMarkets from "@/features/app/components/dock-flyout-markets.vue";
  import DockFlyoutParcels from "@/features/app/components/dock-flyout-parcels.vue";
  import DockFlyoutTransmission from "@/features/app/components/dock-flyout-transmission.vue";
  import MapLayerFlyout from "@/features/app/components/map-layer-flyout.vue";
  import type { MapNavViewModeId } from "@/features/app/components/map-nav.types";
  import { useMapShellContext } from "@/features/app/core/map-shell-context";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";
  import type { FacilityStatusFilterId } from "@/features/app/filters/map-filters.types";
  import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
  import type { FacilitiesViewMode } from "@/features/facilities/facilities.types";
  import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";

  const shell = useMapShellContext();

  const dockTransition = useGsapTransition({
    enter: { from: { x: -16, opacity: 0 }, duration: 0.3, ease: "power3.out" },
    leave: { to: { x: -12, opacity: 0 }, duration: 0.2, ease: "power2.in" },
  });

  const flyoutTransition = useGsapTransition({
    enter: { from: { x: -20, opacity: 0 }, duration: 0.3, ease: "power3.out" },
    leave: { to: { x: -16, opacity: 0 }, duration: 0.2, ease: "power2.in" },
  });

  const layerListRef = ref<HTMLElement | null>(null);
  const { animate: staggerLayerRows } = useGsapStagger({
    container: layerListRef,
    selector: "[data-layer-row]",
    stagger: 0.03,
    duration: 0.25,
    from: { opacity: 0, y: 6 },
  });

  const flyoutRef = ref<InstanceType<typeof MapLayerFlyout> | null>(null);
  const flyoutContentRef = computed(() => flyoutRef.value?.slotContainerRef ?? null);
  const { animate: staggerFlyoutContent } = useGsapStagger({
    container: flyoutContentRef,
    selector: "[data-flyout-section]",
    stagger: 0.04,
    duration: 0.25,
    from: { opacity: 0, y: 8 },
  });
  const mapFilters = inject(MAP_FILTERS_KEY);

  const panelOpen = ref(false);
  const expandedLayer = ref<string | null>(null);

  const boundaryHeatEnabled = shallowRef<Record<BoundaryLayerId, boolean>>({
    county: false,
    state: false,
    country: false,
  });

  function setBoundaryHeat(boundaryId: BoundaryLayerId, enabled: boolean): void {
    boundaryHeatEnabled.value = { ...boundaryHeatEnabled.value, [boundaryId]: enabled };
    shell.setBoundaryHeatEnabled(boundaryId, enabled);
  }

  const colocationViewMode = ref<MapNavViewModeId>(shell.perspectiveViewModes.value.colocation);
  const hyperscaleViewMode = ref<MapNavViewModeId>(shell.perspectiveViewModes.value.hyperscale);

  watch(
    () => shell.perspectiveViewModes.value.colocation,
    (mode) => {
      colocationViewMode.value = mode;
    },
    { immediate: true }
  );

  watch(
    () => shell.perspectiveViewModes.value.hyperscale,
    (mode) => {
      hyperscaleViewMode.value = mode;
    },
    { immediate: true }
  );

  const fiberRoutesVisible = computed(
    () => shell.visibleFiberLayers.value.longhaul || shell.visibleFiberLayers.value.metro
  );

  const coloPowerTypeOptions = [
    { id: "commissioned", label: "Commissioned" },
    { id: "available", label: "Available" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
  ] as const;

  const coloStatusOptions = [
    { id: "commissioned", label: "Operational" },
    { id: "planned", label: "Planned" },
    { id: "under-construction", label: "Under Construction" },
  ] as const;

  const hsPowerTypeOptions = [
    { id: "commissioned", label: "Owned" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
  ] as const;

  const hsStatusOptions = [
    { id: "commissioned", label: "Owned" },
    { id: "planned", label: "Planned" },
    { id: "under-construction", label: "Under Construction" },
  ] as const;

  const marketOptions = computed(
    () => mapFilters?.availableMarkets.value?.map((m) => ({ id: m, label: m })) ?? []
  );

  const providerOptions = computed(
    () => mapFilters?.availableProviders.value?.map((p) => ({ id: p, label: p })) ?? []
  );

  const userOptions = computed<readonly { id: string; label: string }[]>(() => []);

  type LayerDef = {
    readonly id: string;
    readonly label: string;
    readonly visible: () => boolean;
    readonly toggle: () => void;
    readonly hasDrawer: boolean;
    readonly dot: string;
  };

  type SectionItem =
    | { readonly kind: "header"; readonly label: string }
    | { readonly kind: "divider" }
    | { readonly kind: "layer"; readonly layer: LayerDef };

  function toggleFiberRoutes(): void {
    const newVisible = !fiberRoutesVisible.value;
    shell.setFiberLayerVisibility("metro", newVisible);
    shell.setFiberLayerVisibility("longhaul", newVisible);
  }

  function layer(def: LayerDef): SectionItem {
    return { kind: "layer", layer: def };
  }

  const sections: readonly SectionItem[] = [
    { kind: "header", label: "Facilities" },
    layer({
      id: "colocation",
      label: "Colocation",
      dot: "#3b82f6",
      visible: () => shell.visiblePerspectives.value.colocation,
      toggle: () =>
        shell.setPerspectiveVisibility("colocation", !shell.visiblePerspectives.value.colocation),
      hasDrawer: true,
    }),
    layer({
      id: "hyperscale",
      label: "Hyperscale",
      dot: "#059669",
      visible: () => shell.visiblePerspectives.value.hyperscale,
      toggle: () =>
        shell.setPerspectiveVisibility("hyperscale", !shell.visiblePerspectives.value.hyperscale),
      hasDrawer: true,
    }),
    layer({
      id: "hyperscale-leased",
      label: "Hyperscale Leased",
      dot: "#f7cd5e",
      visible: () => shell.visiblePerspectives.value["hyperscale-leased"],
      toggle: () =>
        shell.setPerspectiveVisibility(
          "hyperscale-leased",
          !shell.visiblePerspectives.value["hyperscale-leased"]
        ),
      hasDrawer: false,
    }),
    layer({
      id: "enterprise",
      label: "Enterprise",
      dot: "#4f46e5",
      visible: () => shell.visiblePerspectives.value.enterprise,
      toggle: () =>
        shell.setPerspectiveVisibility("enterprise", !shell.visiblePerspectives.value.enterprise),
      hasDrawer: false,
    }),
    { kind: "divider" },
    { kind: "header", label: "Infrastructure" },
    layer({
      id: "fiber",
      label: "Fiber Routes",
      dot: "#ec4899",
      visible: () => fiberRoutesVisible.value,
      toggle: toggleFiberRoutes,
      hasDrawer: true,
    }),
    layer({
      id: "transmission",
      label: "Transmission Lines",
      dot: "#f97316",
      visible: () => shell.powerVisibility.value.transmission,
      toggle: () =>
        shell.setPowerLayerVisible("transmission", !shell.powerVisibility.value.transmission),
      hasDrawer: true,
    }),
    layer({
      id: "gas",
      label: "Natural Gas Pipelines",
      dot: "#eab308",
      visible: () => shell.gasPipelineVisible.value,
      toggle: () => shell.setGasPipelineVisible(!shell.gasPipelineVisible.value),
      hasDrawer: true,
    }),
    layer({
      id: "parcels",
      label: "US Parcels",
      dot: "#8b5cf6",
      visible: () => shell.parcelsVisible.value,
      toggle: () => shell.setParcelsVisible(!shell.parcelsVisible.value),
      hasDrawer: true,
    }),
    layer({
      id: "substations",
      label: "Substations",
      dot: "#f97316",
      visible: () => shell.powerVisibility.value.substations,
      toggle: () =>
        shell.setPowerLayerVisible("substations", !shell.powerVisibility.value.substations),
      hasDrawer: false,
    }),
    layer({
      id: "plants",
      label: "Power Plants",
      dot: "#f97316",
      visible: () => shell.powerVisibility.value.plants,
      toggle: () => shell.setPowerLayerVisible("plants", !shell.powerVisibility.value.plants),
      hasDrawer: false,
    }),
    { kind: "divider" },
    { kind: "header", label: "Environmental" },
    layer({
      id: "flood100",
      label: "Flood Zones (100yr)",
      dot: "#06b6d4",
      visible: () => shell.floodVisibility.value.flood100,
      toggle: () => shell.setFloodLayerVisible("flood100", !shell.floodVisibility.value.flood100),
      hasDrawer: false,
    }),
    layer({
      id: "flood500",
      label: "Flood Zones (500yr)",
      dot: "#06b6d4",
      visible: () => shell.floodVisibility.value.flood500,
      toggle: () => shell.setFloodLayerVisible("flood500", !shell.floodVisibility.value.flood500),
      hasDrawer: false,
    }),
    layer({
      id: "hydro",
      label: "Hydro Basins",
      dot: "#0ea5e9",
      visible: () => shell.hydroBasinsVisible.value,
      toggle: () => shell.setHydroBasinsVisible(!shell.hydroBasinsVisible.value),
      hasDrawer: false,
    }),
    layer({
      id: "water",
      label: "Water Features",
      dot: "#0ea5e9",
      visible: () => shell.waterVisible.value,
      toggle: () => shell.setWaterVisible(!shell.waterVisible.value),
      hasDrawer: false,
    }),
    { kind: "divider" },
    { kind: "header", label: "Markets" },
    layer({
      id: "markets",
      label: "Market Boundaries",
      dot: "#6366f1",
      visible: () => shell.marketBoundaryVisibility.value.market,
      toggle: () =>
        shell.setMarketBoundaryVisible("market", !shell.marketBoundaryVisibility.value.market),
      hasDrawer: true,
    }),
    layer({
      id: "submarkets",
      label: "Submarket Boundaries",
      dot: "#6366f1",
      visible: () => shell.marketBoundaryVisibility.value.submarket,
      toggle: () =>
        shell.setMarketBoundaryVisible(
          "submarket",
          !shell.marketBoundaryVisibility.value.submarket
        ),
      hasDrawer: false,
    }),
  ];

  const FLYOUT_TITLES: Record<string, string> = {
    colocation: "Colocation Filters",
    hyperscale: "Hyperscale Filters",
    fiber: "Fiber Routes",
    transmission: "Transmission Lines",
    gas: "Gas Pipeline Filters",
    parcels: "Parcel Filters",
    markets: "Market Boundaries",
    basemap: "Basemap Settings",
  };

  const flyoutTitle = computed(() => {
    if (expandedLayer.value === null) {
      return "";
    }
    return FLYOUT_TITLES[expandedLayer.value] ?? "";
  });

  function togglePanel(): void {
    panelOpen.value = !panelOpen.value;
    if (!panelOpen.value) {
      expandedLayer.value = null;
    }
  }

  function toggleExpanded(layerId: string): void {
    expandedLayer.value = expandedLayer.value === layerId ? null : layerId;
  }

  function closeDrawer(): void {
    expandedLayer.value = null;
  }

  function handleLayerToggle(layer: LayerDef): void {
    const wasVisible = layer.visible();
    layer.toggle();
    if (!wasVisible && layer.hasDrawer) {
      expandedLayer.value = layer.id;
    }
    if (wasVisible && expandedLayer.value === layer.id) {
      expandedLayer.value = null;
    }
  }

  function handleFiberToggle(): void {
    const wasVisible = fiberRoutesVisible.value;
    toggleFiberRoutes();
    if (!wasVisible) {
      expandedLayer.value = "fiber";
    } else if (expandedLayer.value === "fiber") {
      expandedLayer.value = null;
    }
  }

  function handleSwitchToggle(layer: LayerDef): void {
    if (layer.id === "fiber") {
      handleFiberToggle();
    } else {
      handleLayerToggle(layer);
    }
  }

  function setColoViewMode(mode: MapNavViewModeId): void {
    colocationViewMode.value = mode;
    shell.setPerspectiveViewMode("colocation", mode as FacilitiesViewMode);
  }

  function setHyperscaleViewMode(mode: MapNavViewModeId): void {
    hyperscaleViewMode.value = mode;
    shell.setPerspectiveViewMode("hyperscale", mode as FacilitiesViewMode);
  }

  function handleEscape(): void {
    if (!panelOpen.value) {
      return;
    }
    if (expandedLayer.value !== null) {
      expandedLayer.value = null;
      return;
    }
    panelOpen.value = false;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      handleEscape();
    }
  }

  watch(panelOpen, (open) => {
    if (open) {
      nextTick(() => staggerLayerRows());
    }
  });

  watch(expandedLayer, (layer) => {
    if (layer !== null) {
      nextTick(() => staggerFlyoutContent());
    }
  });

  onMounted(() => {
    document.addEventListener("keydown", onKeydown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeydown);
  });
</script>

<template>
  <button
    v-if="!panelOpen"
    type="button"
    class="map-glass-button pointer-events-auto absolute left-3 top-3 z-30 flex size-10 items-center justify-center rounded-xl transition-all duration-150 hover:scale-[1.02]"
    aria-label="Open layers panel"
    @click="togglePanel"
  >
    <MapNavIcon name="layers" class="h-[16px] w-[18px] text-foreground/75" />
  </button>

  <Transition
    :css="false"
    @before-enter="dockTransition.onBeforeEnter"
    @enter="dockTransition.onEnter"
    @leave="dockTransition.onLeave"
  >
    <div
      v-if="panelOpen"
      class="pointer-events-none absolute left-3 top-3 z-30 flex items-start gap-0"
    >
      <div
        class="map-glass-elevated pointer-events-auto flex w-[300px] flex-col rounded-2xl"
        style="max-height: calc(100vh - 6rem)"
        role="dialog"
        aria-label="Map layers"
      >
        <div class="flex h-14 items-center justify-between px-5">
          <div class="flex items-center gap-2.5">
            <MapNavIcon name="layers" class="h-[18px] w-[20px] text-foreground/70" />
            <span class="text-base font-bold tracking-tight text-foreground/90">Layers</span>
          </div>
          <span
            class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-foreground/40 transition-colors hover:text-foreground/60"
            role="button"
            tabindex="0"
            aria-label="Close layers panel"
            @click="togglePanel"
            @keydown.enter="togglePanel"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </span>
        </div>

        <div class="mx-4 h-px bg-border/40" />

        <div
          ref="layerListRef"
          class="max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-hide pb-2"
        >
          <template v-for="(item, idx) in sections" :key="idx">
            <div
              v-if="item.kind === 'header'"
              class="px-5 pb-1"
              :class="idx === 0 ? 'pt-3' : 'pt-2.5'"
            >
              <span class="text-[11px] font-semibold uppercase tracking-wider text-foreground/50"
                >{{ item.label }}</span
              >
            </div>

            <div v-else-if="item.kind === 'divider'" class="mx-5 my-1 h-px bg-border/35" />

            <div
              v-else-if="item.kind === 'layer'"
              data-layer-row
              class="flex h-10 items-center justify-between px-5"
            >
              <div class="flex flex-1 items-center gap-2.5">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-150"
                  :style="{
                    backgroundColor: item.layer.dot,
                    boxShadow: item.layer.visible() ? `0 0 6px ${item.layer.dot}50` : 'none',
                  }"
                  :class="item.layer.visible() ? 'opacity-100' : 'opacity-20'"
                  aria-hidden="true"
                />
                <span
                  class="text-sm transition-colors duration-150"
                  :class="item.layer.visible() ? 'font-semibold text-foreground/90' : 'font-medium text-foreground/40'"
                  >{{ item.layer.label }}</span
                >
              </div>
              <div class="flex items-center gap-2">
                <span
                  v-if="item.layer.hasDrawer"
                  class="flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors"
                  :class="expandedLayer === item.layer.id ? 'text-primary drop-shadow-[0_0_3px_rgba(37,99,235,0.3)]' : 'text-foreground/30 hover:text-foreground/55'"
                  role="button"
                  tabindex="0"
                  :title="`${expandedLayer === item.layer.id ? 'Hide' : 'Show'} ${item.layer.label} filters`"
                  :aria-label="`${expandedLayer === item.layer.id ? 'Hide' : 'Show'} ${item.layer.label} filters`"
                  @click="toggleExpanded(item.layer.id)"
                  @keydown.enter="toggleExpanded(item.layer.id)"
                >
                  <svg
                    v-if="expandedLayer === item.layer.id"
                    class="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M1.5 1.5h13L9.75 7.75V13l-3.5 1.5V7.75z" />
                  </svg>
                  <svg
                    v-else
                    class="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    aria-hidden="true"
                  >
                    <path
                      d="M1.5 1.5h13L9.75 7.75V13l-3.5 1.5V7.75z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <Switch
                  :checked="item.layer.visible()"
                  :aria-label="`${item.layer.visible() ? 'Hide' : 'Show'} ${item.layer.label}`"
                  @update:checked="handleSwitchToggle(item.layer)"
                />
              </div>
            </div>
          </template>

          <div class="mx-5 my-1 h-px bg-border/35" />

          <div class="px-5 pt-2.5 pb-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-foreground/50"
              >Basemap</span
            >
          </div>
          <div class="flex h-10 items-center justify-between px-5">
            <span class="flex-1 text-sm font-semibold text-foreground/90">Basemap Settings</span>
            <div class="flex items-center gap-2">
              <span
                class="flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors"
                :class="expandedLayer === 'basemap' ? 'text-primary drop-shadow-[0_0_3px_rgba(37,99,235,0.3)]' : 'text-foreground/30 hover:text-foreground/55'"
                role="button"
                tabindex="0"
                title="Toggle basemap settings"
                aria-label="Toggle basemap settings"
                @click="toggleExpanded('basemap')"
                @keydown.enter="toggleExpanded('basemap')"
              >
                <svg
                  class="h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                  <path
                    d="M6.7 1.2l-.5 1.6a5 5 0 0 0-1.5.9L3.2 3.2l-1.3 2.3 1.1 1.2a5 5 0 0 0 0 1.7l-1.1 1.2 1.3 2.3 1.5-.5a5 5 0 0 0 1.5.9l.5 1.6h2.6l.5-1.6a5 5 0 0 0 1.5-.9l1.5.5 1.3-2.3-1.1-1.2a5 5 0 0 0 0-1.7l1.1-1.2-1.3-2.3-1.5.5a5 5 0 0 0-1.5-.9l-.5-1.6z"
                  />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Transition
        :css="false"
        @before-enter="flyoutTransition.onBeforeEnter"
        @enter="flyoutTransition.onEnter"
        @leave="flyoutTransition.onLeave"
      >
        <MapLayerFlyout
          v-if="expandedLayer !== null"
          ref="flyoutRef"
          :flyout-id="expandedLayer"
          :title="flyoutTitle"
          @close="closeDrawer"
        >
          <DockFlyoutFacilities
            v-if="expandedLayer === 'colocation'"
            perspective="colocation"
            :active-view-mode="colocationViewMode"
            :power-type-options="coloPowerTypeOptions"
            :active-power-types="mapFilters?.state.value?.powerTypes ?? new Set()"
            :status-options="coloStatusOptions"
            :active-statuses="mapFilters?.state.value?.facilityStatuses ?? new Set()"
            :market-options="marketOptions"
            :active-markets="mapFilters?.state.value?.activeMarkets ?? new Set()"
            :provider-options="providerOptions"
            :active-providers="mapFilters?.state.value?.facilityProviders ?? new Set()"
            :user-options="[]"
            :active-users="new Set()"
            :interconnectivity-hub="mapFilters?.state.value?.interconnectivityHub ?? false"
            @update:view-mode="setColoViewMode"
            @toggle:power-type="mapFilters?.togglePowerType($event)"
            @toggle:status="mapFilters?.toggleFacilityStatus($event as FacilityStatusFilterId)"
            @toggle:market="mapFilters?.toggleMarket($event)"
            @toggle:provider="mapFilters?.toggleFacilityProvider($event)"
            @toggle:user="mapFilters?.toggleUser($event)"
            @update:interconnectivity-hub="mapFilters?.setInterconnectivityHub($event)"
          />

          <DockFlyoutFacilities
            v-if="expandedLayer === 'hyperscale'"
            perspective="hyperscale"
            :active-view-mode="hyperscaleViewMode"
            :power-type-options="hsPowerTypeOptions"
            :active-power-types="mapFilters?.state.value?.powerTypes ?? new Set()"
            :status-options="hsStatusOptions"
            :active-statuses="mapFilters?.state.value?.facilityStatuses ?? new Set()"
            :market-options="marketOptions"
            :active-markets="mapFilters?.state.value?.activeMarkets ?? new Set()"
            :provider-options="[]"
            :active-providers="new Set()"
            :user-options="userOptions"
            :active-users="mapFilters?.state.value?.activeUsers ?? new Set()"
            :interconnectivity-hub="false"
            @update:view-mode="setHyperscaleViewMode"
            @toggle:power-type="mapFilters?.togglePowerType($event)"
            @toggle:status="mapFilters?.toggleFacilityStatus($event as FacilityStatusFilterId)"
            @toggle:market="mapFilters?.toggleMarket($event)"
            @toggle:user="mapFilters?.toggleUser($event)"
          />

          <DockFlyoutFiber
            v-if="expandedLayer === 'fiber'"
            :visible-fiber-layers="shell.visibleFiberLayers.value"
            :fiber-source-layer-options="shell.fiberSourceLayerOptions.value"
            :selected-fiber-source-layer-names="shell.selectedFiberSourceLayerNames.value"
            @update:fiber-line-visible="(lineId: FiberLocatorLineId, visible: boolean) => shell.setFiberLayerVisibility(lineId, visible)"
            @toggle-source-layer="shell.setFiberSourceLayerVisible"
          />

          <DockFlyoutTransmission v-if="expandedLayer === 'transmission'" />

          <DockFlyoutGas v-if="expandedLayer === 'gas'" />

          <DockFlyoutParcels v-if="expandedLayer === 'parcels'" />

          <DockFlyoutMarkets
            v-if="expandedLayer === 'markets'"
            :color-mode="shell.marketBoundaryColorMode.value"
            @update:color-mode="shell.setMarketBoundaryColorMode($event)"
          />

          <DockFlyoutBasemap
            v-if="expandedLayer === 'basemap'"
            :basemap-visibility="shell.basemapVisibility.value"
            :boundary-visibility="shell.boundaryVisibility.value"
            :boundary-heat-enabled="boundaryHeatEnabled"
            @update:basemap-layer-visible="shell.setBasemapLayerVisible"
            @update:basemap-layer-color="shell.setBasemapLayerColor"
            @update:boundary-visible="shell.setBoundaryVisible"
            @update:boundary-heat="setBoundaryHeat"
          />
        </MapLayerFlyout>
      </Transition>
    </div>
  </Transition>
</template>
