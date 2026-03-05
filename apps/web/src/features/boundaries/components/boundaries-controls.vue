<script setup lang="ts">
  import { computed, shallowRef } from "vue";
  import Accordion from "@/components/ui/accordion/accordion.vue";
  import AccordionContent from "@/components/ui/accordion/accordion-content.vue";
  import AccordionItem from "@/components/ui/accordion/accordion-item.vue";
  import AccordionTrigger from "@/components/ui/accordion/accordion-trigger.vue";
  import Button from "@/components/ui/button/button.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import Input from "@/components/ui/input/input.vue";
  import { boundaryHeatStops } from "@/features/boundaries/boundaries.service";
  import type {
    BoundaryFacetOption,
    BoundaryLayerId,
  } from "@/features/boundaries/boundaries.types";

  type CheckboxState = boolean | "indeterminate";

  interface BoundariesControlsProps {
    readonly countryFacetOptions: readonly BoundaryFacetOption[];
    readonly countrySelectedRegionIds: readonly string[] | null;
    readonly countryVisible: boolean;
    readonly countyFacetOptions: readonly BoundaryFacetOption[];
    readonly countySelectedRegionIds: readonly string[] | null;
    readonly countyVisible: boolean;
    readonly embedded?: boolean;
    readonly stateFacetOptions: readonly BoundaryFacetOption[];
    readonly stateSelectedRegionIds: readonly string[] | null;
    readonly stateVisible: boolean;
  }

  interface BoundaryLegendBin {
    readonly color: string;
    readonly label: string;
  }

  interface BoundaryFacetSection {
    readonly description: string;
    readonly dotColor: string;
    readonly filteredOptions: readonly BoundaryFacetOption[];
    readonly level: BoundaryLayerId;
    readonly options: readonly BoundaryFacetOption[];
    readonly searchPlaceholder: string;
    readonly searchQuery: string;
    readonly selectedRegionIds: ReadonlySet<string>;
    readonly title: string;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<BoundariesControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:countySelectedRegionIds": [value: readonly string[] | null];
    "update:countyVisible": [value: boolean];
    "update:countrySelectedRegionIds": [value: readonly string[] | null];
    "update:countryVisible": [value: boolean];
    "update:stateSelectedRegionIds": [value: readonly string[] | null];
    "update:stateVisible": [value: boolean];
  }>();

  const countySearchQuery = shallowRef<string>("");
  const stateSearchQuery = shallowRef<string>("");
  const countrySearchQuery = shallowRef<string>("");

  const containerClass = computed(() =>
    props.embedded
      ? "w-full"
      : "w-full rounded-lg border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-sm"
  );

  const heatStops = boundaryHeatStops();

  function asBoolean(state: CheckboxState): boolean {
    return state === true;
  }

  function formatMegawatts(value: number): string {
    return `${Math.round(value).toLocaleString()} MW`;
  }

  function formatMegawattsCompact(value: number): string {
    if (value >= 1000) {
      const inThousands = value / 1000;
      const shouldUseDecimal = value % 1000 !== 0 && value < 10_000;
      return shouldUseDecimal ? `${inThousands.toFixed(1)}k` : `${Math.round(inThousands)}k`;
    }

    return `${value}`;
  }

  function normalizeSearchQuery(value: string): string {
    return value.trim().toLowerCase();
  }

  function formatFacetLabel(option: BoundaryFacetOption): string {
    if (option.parentRegionName === null || option.parentRegionName.length === 0) {
      return option.regionName;
    }

    return `${option.regionName}, ${option.parentRegionName}`;
  }

  function toSelectedIdSet(
    options: readonly BoundaryFacetOption[],
    selectedRegionIds: readonly string[] | null
  ): ReadonlySet<string> {
    if (selectedRegionIds === null) {
      return new Set(options.map((option) => option.regionId));
    }

    return new Set(selectedRegionIds);
  }

  function filterFacetOptions(
    options: readonly BoundaryFacetOption[],
    searchQuery: string
  ): readonly BoundaryFacetOption[] {
    const normalizedQuery = normalizeSearchQuery(searchQuery);
    if (normalizedQuery.length === 0) {
      return options;
    }

    return options.filter((option) => {
      const label = formatFacetLabel(option).toLowerCase();
      if (label.includes(normalizedQuery)) {
        return true;
      }

      return option.regionId.toLowerCase().includes(normalizedQuery);
    });
  }

  function facetOptionsFor(level: BoundaryLayerId): readonly BoundaryFacetOption[] {
    if (level === "county") {
      return props.countyFacetOptions;
    }

    if (level === "state") {
      return props.stateFacetOptions;
    }

    return props.countryFacetOptions;
  }

  function selectedRegionIdsFor(level: BoundaryLayerId): readonly string[] | null {
    if (level === "county") {
      return props.countySelectedRegionIds;
    }

    if (level === "state") {
      return props.stateSelectedRegionIds;
    }

    return props.countrySelectedRegionIds;
  }

  function emitSelectedRegionIds(
    level: BoundaryLayerId,
    nextSelectedRegionIds: readonly string[] | null
  ): void {
    if (level === "county") {
      emit("update:countySelectedRegionIds", nextSelectedRegionIds);
      return;
    }

    if (level === "state") {
      emit("update:stateSelectedRegionIds", nextSelectedRegionIds);
      return;
    }

    emit("update:countrySelectedRegionIds", nextSelectedRegionIds);
  }

  function emitVisibility(level: BoundaryLayerId, visible: boolean): void {
    if (level === "county") {
      emit("update:countyVisible", visible);
      return;
    }

    if (level === "state") {
      emit("update:stateVisible", visible);
      return;
    }

    emit("update:countryVisible", visible);
  }

  function setSearchQuery(level: BoundaryLayerId, nextValue: string): void {
    if (level === "county") {
      countySearchQuery.value = nextValue;
      return;
    }

    if (level === "state") {
      stateSearchQuery.value = nextValue;
      return;
    }

    countrySearchQuery.value = nextValue;
  }

  function applySelection(level: BoundaryLayerId, nextSelectedSet: ReadonlySet<string>): void {
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

  function onSearchInput(level: BoundaryLayerId, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    setSearchQuery(level, target.value);
  }

  function onToggleVisibility(level: BoundaryLayerId, checked: CheckboxState): void {
    emitVisibility(level, asBoolean(checked));
  }

  function onToggleFacet(level: BoundaryLayerId, regionId: string, checked: CheckboxState): void {
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

  function onSelectAll(level: BoundaryLayerId): void {
    emitSelectedRegionIds(level, null);
  }

  function onClearAll(level: BoundaryLayerId): void {
    emitSelectedRegionIds(level, []);
  }

  const legendGradient = computed(() => {
    const maxValue = heatStops.at(-1)?.value ?? 1;
    const gradientStops: string[] = [];

    for (const stop of heatStops) {
      const positionPercent = (stop.value / maxValue) * 100;
      gradientStops.push(`${stop.color} ${positionPercent.toFixed(1)}%`);
    }

    return `linear-gradient(90deg, ${gradientStops.join(", ")})`;
  });

  const legendBins = computed<BoundaryLegendBin[]>(() => {
    const bins: BoundaryLegendBin[] = [];

    for (const [index, stop] of heatStops.entries()) {
      const nextStop = heatStops[index + 1];
      const label = nextStop
        ? `${formatMegawattsCompact(stop.value)}-${formatMegawattsCompact(nextStop.value)} MW`
        : `${formatMegawattsCompact(stop.value)}+ MW`;

      bins.push({
        color: stop.color,
        label,
      });
    }

    return bins;
  });

  const facetSections = computed<BoundaryFacetSection[]>(() => [
    {
      level: "county",
      title: "County",
      dotColor: "#6b7280",
      description: "County boundaries by commissioned MW",
      visible: props.countyVisible,
      options: props.countyFacetOptions,
      selectedRegionIds: toSelectedIdSet(props.countyFacetOptions, props.countySelectedRegionIds),
      filteredOptions: filterFacetOptions(props.countyFacetOptions, countySearchQuery.value),
      searchQuery: countySearchQuery.value,
      searchPlaceholder: "Search county or state",
    },
    {
      level: "state",
      title: "State",
      dotColor: "#374151",
      description: "State boundaries by commissioned MW",
      visible: props.stateVisible,
      options: props.stateFacetOptions,
      selectedRegionIds: toSelectedIdSet(props.stateFacetOptions, props.stateSelectedRegionIds),
      filteredOptions: filterFacetOptions(props.stateFacetOptions, stateSearchQuery.value),
      searchQuery: stateSearchQuery.value,
      searchPlaceholder: "Search state",
    },
    {
      level: "country",
      title: "Country",
      dotColor: "#1f2937",
      description: "Country boundaries by commissioned MW",
      visible: props.countryVisible,
      options: props.countryFacetOptions,
      selectedRegionIds: toSelectedIdSet(props.countryFacetOptions, props.countrySelectedRegionIds),
      filteredOptions: filterFacetOptions(props.countryFacetOptions, countrySearchQuery.value),
      searchQuery: countrySearchQuery.value,
      searchPlaceholder: "Search country",
    },
  ]);
</script>

<template>
  <aside :class="containerClass" aria-label="Boundary layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Boundaries</h2>
      <span class="text-[11px] text-muted-foreground">County, state, country</span>
    </header>

    <div class="grid gap-2">
      <section
        v-for="section in facetSections"
        :key="section.level"
        class="rounded-md border border-border/70 p-2"
      >
        <div class="flex items-start gap-3">
          <Checkbox
            :checked="section.visible"
            @update:checked="onToggleVisibility(section.level, $event)"
          />

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 rounded-full"
                :style="{ backgroundColor: section.dotColor }"
              />
              <span class="text-xs font-medium">{{ section.title }}</span>
            </div>
            <p class="mt-1 break-words text-[11px] text-muted-foreground">
              {{ section.description }}
            </p>
          </div>
        </div>

        <Accordion type="single" collapsible class="mt-2 rounded-md border border-border/60 px-2">
          <AccordionItem value="filters" class="border-b-0">
            <AccordionTrigger class="py-1.5 text-xs font-medium hover:no-underline">
              <span>{{ section.title }} filters</span>
              <span class="text-[10px] text-muted-foreground"
                >{{ section.options.length }}
                total</span
              >
            </AccordionTrigger>

            <AccordionContent>
              <div class="grid gap-2">
                <Input
                  :value="section.searchQuery"
                  :placeholder="section.searchPlaceholder"
                  class="h-8 text-xs"
                  @input="onSearchInput(section.level, $event)"
                />

                <div class="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-7 px-2 text-[11px]"
                    @click="onSelectAll(section.level)"
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-7 px-2 text-[11px]"
                    @click="onClearAll(section.level)"
                  >
                    Clear all
                  </Button>
                </div>

                <div class="max-h-44 overflow-y-auto rounded-md border border-border/60 p-1">
                  <p
                    v-if="section.filteredOptions.length === 0"
                    class="px-2 py-3 text-center text-[11px] text-muted-foreground"
                  >
                    No matching {{ section.title.toLowerCase() }} regions.
                  </p>

                  <div
                    v-for="option in section.filteredOptions"
                    :key="option.regionId"
                    class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40"
                  >
                    <Checkbox
                      :checked="section.selectedRegionIds.has(option.regionId)"
                      @update:checked="onToggleFacet(section.level, option.regionId, $event)"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[11px] font-medium">{{ formatFacetLabel(option) }}</p>
                      <p class="truncate text-[10px] text-muted-foreground">
                        {{ option.regionId }}
                        · {{ formatMegawatts(option.commissionedPowerMw) }}
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
      class="mt-3 rounded-md border border-border/70 p-2"
      aria-label="Commissioned power legend"
    >
      <h3 class="text-[11px] font-medium">Commissioned Power (MW)</h3>
      <div class="mt-2 h-2.5 w-full rounded-sm" :style="{ background: legendGradient }" />

      <ul class="mt-2 grid gap-1 text-[10px] text-muted-foreground">
        <li v-for="bin in legendBins" :key="bin.label" class="flex items-center gap-2">
          <span
            class="h-2.5 w-2.5 rounded-[2px] border border-border/50"
            :style="{ backgroundColor: bin.color }"
            aria-hidden="true"
          />
          <span>{{ bin.label }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>
