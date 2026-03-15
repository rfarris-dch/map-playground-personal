<script setup lang="ts">
  import { computed, shallowRef } from "vue";
  import LayerControlsPanel from "@/components/map/layer-controls-panel.vue";
  import Accordion from "@/components/ui/accordion/accordion.vue";
  import AccordionContent from "@/components/ui/accordion/accordion-content.vue";
  import AccordionItem from "@/components/ui/accordion/accordion-item.vue";
  import AccordionTrigger from "@/components/ui/accordion/accordion-trigger.vue";
  import Button from "@/components/ui/button/button.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import Input from "@/components/ui/input/input.vue";
  import { marketBoundaryHeatStops } from "@/features/market-boundaries/market-boundaries.service";
  import type {
    MarketBoundaryColorMode,
    MarketBoundaryFacetOption,
    MarketBoundaryLayerId,
  } from "@/features/market-boundaries/market-boundaries.types";

  type CheckboxState = boolean | "indeterminate";

  interface MarketBoundariesControlsProps {
    readonly colorMode: MarketBoundaryColorMode;
    readonly embedded?: boolean;
    readonly marketFacetOptions: readonly MarketBoundaryFacetOption[];
    readonly marketSelectedRegionIds: readonly string[] | null;
    readonly marketVisible: boolean;
    readonly submarketFacetOptions: readonly MarketBoundaryFacetOption[];
    readonly submarketSelectedRegionIds: readonly string[] | null;
    readonly submarketVisible: boolean;
  }

  interface MarketBoundaryLegendBin {
    readonly color: string;
    readonly label: string;
  }

  interface MarketBoundaryFacetSection {
    readonly description: string;
    readonly dotClass: string;
    readonly filteredOptions: readonly MarketBoundaryFacetOption[];
    readonly level: MarketBoundaryLayerId;
    readonly options: readonly MarketBoundaryFacetOption[];
    readonly searchPlaceholder: string;
    readonly searchQuery: string;
    readonly selectedRegionIds: ReadonlySet<string>;
    readonly title: string;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<MarketBoundariesControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:colorMode": [value: MarketBoundaryColorMode];
    "update:marketSelectedRegionIds": [value: readonly string[] | null];
    "update:marketVisible": [value: boolean];
    "update:submarketSelectedRegionIds": [value: readonly string[] | null];
    "update:submarketVisible": [value: boolean];
  }>();

  const marketSearchQuery = shallowRef<string>("");
  const submarketSearchQuery = shallowRef<string>("");

  const colorModeOptions: readonly { readonly label: string; readonly value: MarketBoundaryColorMode }[] = [
    { label: "Commissioned Power", value: "power" },
    { label: "Vacancy Rate", value: "vacancy" },
    { label: "Absorption", value: "absorption" },
  ];

  function asBoolean(state: CheckboxState): boolean {
    return state === true;
  }

  function formatMetricValue(value: number | null, mode: MarketBoundaryColorMode): string {
    if (value === null) {
      return "N/A";
    }

    if (mode === "power") {
      return `${Math.round(value).toLocaleString()} MW`;
    }

    if (mode === "vacancy") {
      return `${(value * 100).toFixed(1)}%`;
    }

    return `${Math.round(value).toLocaleString()} MW`;
  }

  function formatLegendValue(value: number, mode: MarketBoundaryColorMode): string {
    if (mode === "vacancy") {
      return `${(value * 100).toFixed(0)}%`;
    }

    if (mode === "absorption") {
      return `${value >= 0 ? "+" : ""}${value}`;
    }

    if (value >= 1000) {
      return `${Math.round(value / 1000)}k`;
    }

    return `${value}`;
  }

  function normalizeSearchQuery(value: string): string {
    return value.trim().toLowerCase();
  }

  function formatFacetLabel(option: MarketBoundaryFacetOption): string {
    if (option.parentRegionName === null || option.parentRegionName.length === 0) {
      return option.regionName;
    }

    return `${option.regionName}, ${option.parentRegionName}`;
  }

  function toSelectedIdSet(
    options: readonly MarketBoundaryFacetOption[],
    selectedRegionIds: readonly string[] | null
  ): ReadonlySet<string> {
    if (selectedRegionIds === null) {
      return new Set(options.map((option) => option.regionId));
    }

    return new Set(selectedRegionIds);
  }

  function filterFacetOptions(
    options: readonly MarketBoundaryFacetOption[],
    searchQuery: string
  ): readonly MarketBoundaryFacetOption[] {
    const normalizedQuery = normalizeSearchQuery(searchQuery);
    if (normalizedQuery.length === 0) {
      return options;
    }

    return options.filter((option) => {
      const label = formatFacetLabel(option).toLowerCase();
      return label.includes(normalizedQuery) || option.regionId.toLowerCase().includes(normalizedQuery);
    });
  }

  function facetOptionsFor(level: MarketBoundaryLayerId): readonly MarketBoundaryFacetOption[] {
    return level === "market" ? props.marketFacetOptions : props.submarketFacetOptions;
  }

  function selectedRegionIdsFor(level: MarketBoundaryLayerId): readonly string[] | null {
    return level === "market" ? props.marketSelectedRegionIds : props.submarketSelectedRegionIds;
  }

  function emitSelectedRegionIds(
    level: MarketBoundaryLayerId,
    nextSelectedRegionIds: readonly string[] | null
  ): void {
    if (level === "market") {
      emit("update:marketSelectedRegionIds", nextSelectedRegionIds);
      return;
    }

    emit("update:submarketSelectedRegionIds", nextSelectedRegionIds);
  }

  function emitVisibility(level: MarketBoundaryLayerId, visible: boolean): void {
    if (level === "market") {
      emit("update:marketVisible", visible);
      return;
    }

    emit("update:submarketVisible", visible);
  }

  function setSearchQuery(level: MarketBoundaryLayerId, nextValue: string): void {
    if (level === "market") {
      marketSearchQuery.value = nextValue;
      return;
    }

    submarketSearchQuery.value = nextValue;
  }

  function applySelection(level: MarketBoundaryLayerId, nextSelectedSet: ReadonlySet<string>): void {
    const options = facetOptionsFor(level);
    if (options.length === 0) {
      emitSelectedRegionIds(level, []);
      return;
    }

    if (nextSelectedSet.size >= options.length) {
      emitSelectedRegionIds(level, null);
      return;
    }

    const orderedRegionIds = options
      .map((option) => option.regionId)
      .filter((regionId) => nextSelectedSet.has(regionId));

    emitSelectedRegionIds(level, orderedRegionIds);
  }

  function onSearchInput(level: MarketBoundaryLayerId, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    setSearchQuery(level, target.value);
  }

  function onToggleVisibility(level: MarketBoundaryLayerId, checked: CheckboxState): void {
    emitVisibility(level, asBoolean(checked));
  }

  function onToggleFacet(level: MarketBoundaryLayerId, regionId: string, checked: CheckboxState): void {
    const options = facetOptionsFor(level);
    const currentSelection = selectedRegionIdsFor(level);
    const nextSelectedSet = new Set<string>(
      currentSelection === null
        ? options.map((option) => option.regionId)
        : currentSelection.map((selectedRegionId) => selectedRegionId)
    );

    if (asBoolean(checked)) {
      nextSelectedSet.add(regionId);
    } else {
      nextSelectedSet.delete(regionId);
    }

    applySelection(level, nextSelectedSet);
  }

  function onSelectAll(level: MarketBoundaryLayerId): void {
    emitSelectedRegionIds(level, null);
  }

  function onClearAll(level: MarketBoundaryLayerId): void {
    emitSelectedRegionIds(level, []);
  }

  function onColorModeChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    emit("update:colorMode", target.value as MarketBoundaryColorMode);
  }

  function sectionClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-sm";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }

  function facetRowClass(selected: boolean): string {
    if (selected) {
      return "border-border bg-background";
    }

    return "border-transparent hover:border-border hover:bg-background";
  }

  const heatStops = computed(() => marketBoundaryHeatStops(props.colorMode));

  const legendBins = computed<MarketBoundaryLegendBin[]>(() => {
    const bins: MarketBoundaryLegendBin[] = [];
    const stops = heatStops.value;

    for (const [index, stop] of stops.entries()) {
      const nextStop = stops[index + 1];
      const label = nextStop
        ? `${formatLegendValue(stop.value, props.colorMode)}-${formatLegendValue(nextStop.value, props.colorMode)}`
        : `${formatLegendValue(stop.value, props.colorMode)}+`;

      bins.push({
        color: stop.color,
        label,
      });
    }

    return bins;
  });

  const facetSections = computed<MarketBoundaryFacetSection[]>(() => [
    {
      level: "market",
      title: "Market",
      dotClass: "bg-indigo-500",
      description: "Market boundary polygons",
      visible: props.marketVisible,
      options: props.marketFacetOptions,
      selectedRegionIds: toSelectedIdSet(props.marketFacetOptions, props.marketSelectedRegionIds),
      filteredOptions: filterFacetOptions(props.marketFacetOptions, marketSearchQuery.value),
      searchQuery: marketSearchQuery.value,
      searchPlaceholder: "Search markets",
    },
    {
      level: "submarket",
      title: "Submarket",
      dotClass: "bg-violet-500",
      description: "Submarket Voronoi boundaries",
      visible: props.submarketVisible,
      options: props.submarketFacetOptions,
      selectedRegionIds: toSelectedIdSet(props.submarketFacetOptions, props.submarketSelectedRegionIds),
      filteredOptions: filterFacetOptions(props.submarketFacetOptions, submarketSearchQuery.value),
      searchQuery: submarketSearchQuery.value,
      searchPlaceholder: "Search submarkets",
    },
  ]);
</script>

<template>
  <LayerControlsPanel
    ariaLabel="Market boundary layers"
    :embedded="props.embedded"
    title="Markets"
    subtitle="Market, submarket"
  >
    <div class="mb-2 rounded-sm border border-border bg-card p-2 shadow-sm">
      <label class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="font-semibold">Color by</span>
        <select
          class="flex-1 rounded-sm border border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm focus-visible:border-border focus-visible:ring-2 focus-visible:ring-border focus-visible:outline-none"
          :value="props.colorMode"
          @change="onColorModeChange"
        >
          <option v-for="opt in colorModeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="grid gap-2">
      <section
        v-for="section in facetSections"
        :key="section.level"
        class="rounded-sm border px-3 py-1 transition-colors"
        :class="sectionClass(section.visible)"
      >
        <div class="flex items-start gap-2">
          <Checkbox
            :checked="section.visible"
            class="h-4 w-4 shrink-0 rounded-sm border border-border bg-card text-muted-foreground shadow-none data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-white"
            @update:checked="onToggleVisibility(section.level, $event)"
          />

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full" :class="section.dotClass" />
              <span
                class="text-xs font-semibold transition-colors"
                :class="section.visible ? 'text-foreground/70' : 'text-muted-foreground'"
                >{{ section.title }}</span
              >
            </div>
            <p
              class="mt-1 break-words text-xs transition-colors"
              :class="section.visible ? 'text-foreground/70' : 'text-muted-foreground'"
            >
              {{ section.description }}
            </p>
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          class="mt-2 rounded-sm border border-border bg-card px-2 shadow-sm"
        >
          <AccordionItem value="filters" class="border-b-0">
            <AccordionTrigger
              class="py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground/70 hover:no-underline data-[state=open]:text-foreground/70"
            >
              <span>{{ section.title }} filters</span>
              <span class="text-xs text-muted-foreground"
                >{{ section.options.length }}
                total</span
              >
            </AccordionTrigger>

            <AccordionContent>
              <div class="grid gap-2">
                <Input
                  :value="section.searchQuery"
                  :placeholder="section.searchPlaceholder"
                  class="h-8 rounded-sm border border-border bg-card px-2 text-xs text-muted-foreground shadow-sm placeholder:text-border focus-visible:border-border focus-visible:ring-2 focus-visible:ring-border"
                  @input="onSearchInput(section.level, $event)"
                />

                <div class="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="glass"
                    class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-sm hover:border-border hover:bg-background hover:text-foreground/70"
                    @click="onSelectAll(section.level)"
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="glass"
                    class="h-[22px] rounded-sm border border-border bg-card px-2 text-xs font-normal text-muted-foreground shadow-sm hover:border-border hover:bg-background hover:text-foreground/70"
                    @click="onClearAll(section.level)"
                  >
                    Clear all
                  </Button>
                </div>

                <div
                  class="max-h-44 overflow-y-auto rounded-sm border border-border bg-card p-1 shadow-sm"
                >
                  <p
                    v-if="section.filteredOptions.length === 0"
                    class="px-2 py-3 text-center text-xs text-muted-foreground"
                  >
                    No matching {{ section.title.toLowerCase() }} regions.
                  </p>

                  <div
                    v-for="option in section.filteredOptions"
                    :key="option.regionId"
                    class="flex items-center gap-2 rounded-sm border px-1.5 py-1 transition-colors"
                    :class="facetRowClass(section.selectedRegionIds.has(option.regionId))"
                  >
                    <Checkbox
                      :checked="section.selectedRegionIds.has(option.regionId)"
                      class="h-4 w-4 shrink-0 rounded-sm border border-border bg-card text-muted-foreground shadow-none data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-white"
                      @update:checked="onToggleFacet(section.level, option.regionId, $event)"
                    />
                    <div class="min-w-0 flex-1">
                      <p
                        class="truncate text-xs font-semibold transition-colors"
                        :class="
                          section.selectedRegionIds.has(option.regionId)
                            ? 'text-foreground/70'
                            : 'text-muted-foreground'
                        "
                      >
                        {{ formatFacetLabel(option) }}
                      </p>
                      <p
                        class="truncate text-xs transition-colors"
                        :class="
                          section.selectedRegionIds.has(option.regionId)
                            ? 'text-foreground/70'
                            : 'text-muted-foreground'
                        "
                      >
                        {{ formatMetricValue(option.commissionedPowerMw, 'power') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>

    <section
      class="mt-3 rounded-sm border border-border bg-card p-2 shadow-sm"
      aria-label="Market boundary legend"
    >
      <h3 class="text-xs font-semibold text-muted-foreground">
        {{ colorModeOptions.find((opt) => opt.value === props.colorMode)?.label ?? 'Legend' }}
      </h3>

      <ul class="mt-2 grid gap-1 text-xs text-muted-foreground">
        <li v-for="bin in legendBins" :key="bin.label" class="flex items-center gap-2">
          <span
            class="h-2.5 w-2.5 rounded-sm border border-border"
            :style="{ backgroundColor: bin.color }"
            aria-hidden="true"
          />
          <span>{{ bin.label }}</span>
        </li>
      </ul>
    </section>
  </LayerControlsPanel>
</template>
