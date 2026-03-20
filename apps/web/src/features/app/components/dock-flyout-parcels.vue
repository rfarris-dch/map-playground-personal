<script setup lang="ts">
  import { ChevronUp, Search } from "lucide-vue-next";
  import { computed, inject, ref, watch } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import Slider from "@/components/ui/slider/slider.vue";
  import type { FilterOption } from "@/features/app/components/app-filter-panel.vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";

  const mapFilters = inject(MAP_FILTERS_KEY);

  const ALL_ZONING_TYPES: readonly FilterOption[] = [
    { id: "residential", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "industrial", label: "Industrial" },
    { id: "agriculture", label: "Agriculture" },
    { id: "special", label: "Special" },
    { id: "mixed", label: "Mixed" },
  ];

  const ALL_FLOOD_ZONES: readonly FilterOption[] = [
    { id: "low-risk", label: "Low Risk" },
    { id: "high-risk", label: "High Risk" },
    { id: "coastal-high-risk", label: "Coastal High Risk" },
  ];

  const zoningTypeOptions = computed<readonly FilterOption[]>(() => {
    const facets = mapFilters?.parcelViewportFacets.value;
    if (!facets || facets.zoningTypes.size === 0) {
      return ALL_ZONING_TYPES;
    }
    const viewportLower = new Set([...facets.zoningTypes].map((z) => z.toLowerCase()));
    return ALL_ZONING_TYPES.filter((opt) => viewportLower.has(opt.id));
  });

  const floodZoneOptions = computed<readonly FilterOption[]>(() => {
    const facets = mapFilters?.parcelViewportFacets.value;
    if (!facets || facets.floodZones.size === 0) {
      return ALL_FLOOD_ZONES;
    }
    const FLOOD_ZONE_TO_FILTER: Record<string, string> = {
      X: "low-risk",
      C: "low-risk",
      A: "high-risk",
      AE: "high-risk",
      AH: "high-risk",
      AO: "high-risk",
      A99: "high-risk",
      V: "coastal-high-risk",
      VE: "coastal-high-risk",
    };
    const viewportFilterIds = new Set(
      [...facets.floodZones]
        .map((zone) => FLOOD_ZONE_TO_FILTER[zone])
        .filter((id): id is string => id !== undefined)
    );
    return ALL_FLOOD_ZONES.filter((opt) => viewportFilterIds.has(opt.id));
  });

  const activeZoningTypes = computed(
    () => mapFilters?.state.value?.zoningTypes ?? new Set<string>()
  );
  const activeFloodZones = computed(() => mapFilters?.state.value?.floodZones ?? new Set<string>());

  const facets = computed(() => mapFilters?.parcelViewportFacets.value ?? null);

  const acresMin = computed(() => {
    const v = facets.value?.acresMin;
    return typeof v === "number" ? Math.floor(v) : 0;
  });
  const acresMax = computed(() => {
    const v = facets.value?.acresMax;
    return typeof v === "number" ? Math.ceil(v) : 100;
  });
  const distMin = computed(() => {
    const v = facets.value?.distTransmissionMin;
    return typeof v === "number" ? Math.floor(v) : 0;
  });
  const distMax = computed(() => {
    const v = facets.value?.distTransmissionMax;
    return typeof v === "number" ? Math.ceil(v) : 100;
  });

  const ownerSearch = ref("");

  const sizeRangeOverride = ref<number[] | null>(null);
  const sizeRange = computed({
    get: () => sizeRangeOverride.value ?? [acresMin.value, acresMax.value],
    set: (v: number[]) => {
      sizeRangeOverride.value = v;
      const lo = v[0] ?? null;
      const hi = v[1] ?? null;
      const isFullRange = lo === acresMin.value && hi === acresMax.value;
      mapFilters?.setParcelAcresRange(isFullRange ? null : lo, isFullRange ? null : hi);
    },
  });

  const distRangeOverride = ref<number[] | null>(null);
  const distanceRange = computed({
    get: () => distRangeOverride.value ?? [distMin.value, distMax.value],
    set: (v: number[]) => {
      distRangeOverride.value = v;
    },
  });

  watch(facets, () => {
    const prev = sizeRangeOverride.value;
    if (prev !== null) {
      const lo = Math.max(prev[0] ?? acresMin.value, acresMin.value);
      const hi = Math.min(prev[1] ?? acresMax.value, acresMax.value);
      const isFullRange = lo <= acresMin.value && hi >= acresMax.value;
      if (isFullRange) {
        sizeRangeOverride.value = null;
        mapFilters?.setParcelAcresRange(null, null);
      } else {
        sizeRangeOverride.value = [lo, hi];
        mapFilters?.setParcelAcresRange(lo, hi);
      }
    }

    const prevDist = distRangeOverride.value;
    if (prevDist !== null) {
      const lo = Math.max(prevDist[0] ?? distMin.value, distMin.value);
      const hi = Math.min(prevDist[1] ?? distMax.value, distMax.value);
      const isFullRange = lo <= distMin.value && hi >= distMax.value;
      if (isFullRange) {
        distRangeOverride.value = null;
      } else {
        distRangeOverride.value = [lo, hi];
      }
    }
  });

  const expandedSections = ref(new Set<string>());

  function toggleSection(section: string): void {
    if (expandedSections.value.has(section)) {
      expandedSections.value.delete(section);
    } else {
      expandedSections.value.add(section);
    }
  }

  function isSectionOpen(section: string): boolean {
    return expandedSections.value.has(section);
  }
</script>

<template>
  <div class="flyout-sections flex flex-col">
    <!-- Owner -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('owner')"
      >
        <span class="text-xs font-semibold text-foreground/50">Owner</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('owner') }"
        />
      </button>
      <template v-if="isSectionOpen('owner')">
        <div class="relative mt-1">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            v-model="ownerSearch"
            type="text"
            placeholder="Search"
            class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
        </div>
      </template>
    </div>

    <!-- Size (Acres) -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('size')"
      >
        <span class="text-xs font-semibold text-foreground/50">Size (Acres)</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('size') }"
        />
      </button>
      <div v-if="isSectionOpen('size')" class="mt-2 px-1">
        <div class="mb-1.5 flex items-center justify-between">
          <span
            class="rounded bg-foreground/50 px-1 py-0.5 text-[6px] font-semibold leading-none text-white shadow-sm"
            >{{ sizeRange[0] }}</span
          >
          <span
            class="rounded bg-foreground/50 px-1 py-0.5 text-[6px] font-semibold leading-none text-white shadow-sm"
            >{{ sizeRange[1] }}</span
          >
        </div>
        <Slider v-model="sizeRange" :min="acresMin" :max="acresMax" :step="1" />
      </div>
    </div>

    <!-- Zoning Type -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('zoning')"
      >
        <span class="text-xs font-semibold text-foreground/50">Zoning Type</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('zoning') }"
        />
      </button>
      <div v-if="isSectionOpen('zoning')" class="mt-1 flex flex-col gap-0.5 pl-2">
        <label
          v-for="opt in zoningTypeOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox
            :checked="activeZoningTypes.has(opt.id)"
            @update:checked="mapFilters?.toggleZoningType(opt.id)"
          />
          <span class="min-w-0 flex-1 truncate text-[10px] text-foreground/50"
            >{{ opt.label }}</span
          >
        </label>
      </div>
    </div>

    <!-- Distance to Transmission Lines (mi) -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('distance')"
      >
        <span class="text-xs font-semibold text-foreground/50"
          >Distance to Transmission Lines (mi)</span
        >
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('distance') }"
        />
      </button>
      <div v-if="isSectionOpen('distance')" class="mt-2 px-1">
        <div class="mb-1.5 flex items-center justify-between">
          <span
            class="rounded bg-foreground/50 px-1 py-0.5 text-[6px] font-semibold leading-none text-white shadow-sm"
            >{{ distanceRange[0] }}</span
          >
          <span
            class="rounded bg-foreground/50 px-1 py-0.5 text-[6px] font-semibold leading-none text-white shadow-sm"
            >{{ distanceRange[1] }}</span
          >
        </div>
        <Slider v-model="distanceRange" :min="distMin" :max="distMax" :step="1" />
      </div>
    </div>

    <!-- Flood Zone -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('flood')"
      >
        <span class="text-xs font-semibold text-foreground/50">Flood Zone</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('flood') }"
        />
      </button>
      <div v-if="isSectionOpen('flood')" class="mt-1 flex flex-col gap-0.5 pl-2">
        <label
          v-for="opt in floodZoneOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox
            :checked="activeFloodZones.has(opt.id)"
            @update:checked="mapFilters?.toggleFloodZone(opt.id)"
          />
          <span class="min-w-0 flex-1 truncate text-[10px] text-foreground/50"
            >{{ opt.label }}</span
          >
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .flyout-sections > * {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .flyout-sections > *:first-child {
    padding-top: 0;
  }

  .flyout-sections > *:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .section-toggle {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }
</style>
