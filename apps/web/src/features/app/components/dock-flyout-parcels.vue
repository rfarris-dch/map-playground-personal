<script setup lang="ts">
  import { Search } from "lucide-vue-next";
  import { computed, inject, ref } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import type { FilterOption } from "@/features/app/components/app-filter-panel.vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";

  const mapFilters = inject(MAP_FILTERS_KEY);

  const ALL_ZONING_TYPES: readonly FilterOption[] = [
    { id: "residential", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "industrial", label: "Industrial" },
    { id: "agriculture", label: "Agriculture" },
    { id: "exempt", label: "Exempt" },
    { id: "farmland", label: "Farmland" },
    { id: "mixed", label: "Mixed" },
    { id: "unzoned", label: "Unzoned" },
    { id: "special", label: "Special" },
  ];

  const ALL_FLOOD_ZONES: readonly FilterOption[] = [
    { id: "low-risk", label: "Low Risk" },
    { id: "high-risk", label: "High Risk" },
    { id: "coastal-high-risk", label: "Coastal High Risk" },
  ];

  const parcelDatasetOptions: readonly FilterOption[] = [{ id: "", label: "All Datasets" }];
  const parcelStyleOptions: readonly FilterOption[] = [{ id: "", label: "All Sizes" }];
  const parcelDavOptions: readonly FilterOption[] = [{ id: "", label: "Any %" }];

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
      X: "low-risk", C: "low-risk",
      A: "high-risk", AE: "high-risk", AH: "high-risk", AO: "high-risk", A99: "high-risk",
      V: "coastal-high-risk", VE: "coastal-high-risk",
    };
    const viewportFilterIds = new Set(
      [...facets.floodZones]
        .map((zone) => FLOOD_ZONE_TO_FILTER[zone])
        .filter((id): id is string => id !== undefined)
    );
    return ALL_FLOOD_ZONES.filter((opt) => viewportFilterIds.has(opt.id));
  });

  const parcelDropdowns = computed(() => ({
    dataset: mapFilters?.state.value?.parcelDataset ?? "",
    styleAcres: mapFilters?.state.value?.parcelStyleAcres ?? "",
    davPercent: mapFilters?.state.value?.parcelDavPercent ?? "",
  }));

  const activeZoningTypes = computed(() => mapFilters?.state.value?.zoningTypes ?? new Set<string>());
  const activeFloodZones = computed(() => mapFilters?.state.value?.floodZones ?? new Set<string>());

  const ownerSearch = ref("");
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Owner</span>
      <div class="relative">
        <Search class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="ownerSearch"
          type="text"
          placeholder="Search owners..."
          class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Parcel Dataset</span>
      <select
        :value="parcelDropdowns.dataset"
        class="h-7 w-full rounded-md border border-border bg-transparent px-2 text-xs text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        @change="mapFilters?.setParcelDataset(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in parcelDatasetOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Size (Acres)</span>
      <select
        :value="parcelDropdowns.styleAcres"
        class="h-7 w-full rounded-md border border-border bg-transparent px-2 text-xs text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        @change="mapFilters?.setParcelStyleAcres(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in parcelStyleOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>
    </div>

    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Zoning Type</span>
      <div class="mt-1 flex flex-col gap-0.5">
        <label
          v-for="opt in zoningTypeOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="activeZoningTypes.has(opt.id)"
            @update:checked="mapFilters?.toggleZoningType(opt.id)"
          />
          <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Distance to Transmission Lines (mi)</span>
      <select
        :value="parcelDropdowns.davPercent"
        class="h-7 w-full rounded-md border border-border bg-transparent px-2 text-xs text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        @change="mapFilters?.setParcelDavPercent(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in parcelDavOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>
    </div>

    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Flood Zone</span>
      <div class="mt-1 flex flex-col gap-0.5">
        <label
          v-for="opt in floodZoneOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="activeFloodZones.has(opt.id)"
            @update:checked="mapFilters?.toggleFloodZone(opt.id)"
          />
          <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
