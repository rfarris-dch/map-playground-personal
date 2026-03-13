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
    readonly dotClass: string;
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
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-md font-sans text-muted-foreground"
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

  const legendBins = computed<BoundaryLegendBin[]>(() => {
    const bins: BoundaryLegendBin[] = [];

    for (const [index, stop] of heatStops.entries()) {
      const nextStop = heatStops[index + 1];
      const label = nextStop
        ? `${formatMegawattsCompact(stop.value)}-${formatMegawattsCompact(nextStop.value)} MW`
        : `${formatMegawattsCompact(stop.value)}+ MW`;

      bins.push({
        color: "",
        label,
      });
    }

    return bins;
  });

  const facetSections = computed<BoundaryFacetSection[]>(() => [
    {
      level: "county",
      title: "County",
      dotClass: "bg-gray-500",
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
      dotClass: "bg-gray-700",
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
      dotClass: "bg-gray-800",
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
      <h2 class="m-0 text-xs font-semibold tracking-wide text-muted-foreground">Boundaries</h2>
      <span class="text-xs text-muted-foreground">County, state, country</span>
    </header>

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
            class="mt-[1px] h-4 w-4 shrink-0 rounded-sm border border-border bg-card text-muted-foreground shadow-none data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-white"
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
      class="mt-3 rounded-sm border border-border bg-card p-2 shadow-sm"
      aria-label="Commissioned power legend"
    >
      <h3 class="text-xs font-semibold text-muted-foreground">Commissioned Power (MW)</h3>

      <ul class="mt-2 grid gap-1 text-xs text-muted-foreground">
        <li v-for="bin in legendBins" :key="bin.label" class="flex items-center gap-2">
          <span
            class="h-2.5 w-2.5 rounded-sm border border-border bg-background"
            aria-hidden="true"
          />
          <span>{{ bin.label }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>
