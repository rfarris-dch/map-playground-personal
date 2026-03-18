<script setup lang="ts">
  import { computed, inject } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";

  const mapFilters = inject(MAP_FILTERS_KEY);

  interface ColoredOption {
    readonly id: string;
    readonly label: string;
    readonly color: string;
  }

  const capacityOptions: readonly ColoredOption[] = [
    { id: "0-25", label: "0 – 25", color: "#F1B51F" },
    { id: "25-100", label: "25 – 100", color: "#E21111" },
    { id: "100-350", label: "100 – 350", color: "#D13CFF" },
    { id: "350-800", label: "350 – 800", color: "#00B9C6" },
    { id: "800+", label: "800+", color: "#4908A7" },
  ];

  const statusOptions: readonly ColoredOption[] = [
    { id: "operating", label: "Operating", color: "#16a34a" },
    { id: "proposed", label: "Proposed", color: "#2563eb" },
    { id: "announced", label: "Announced", color: "#7c3aed" },
    { id: "discovered", label: "Discovered", color: "#d97706" },
    { id: "construction", label: "Construction", color: "#f97316" },
    { id: "in development", label: "In Development", color: "#6366f1" },
  ];

  const activeCapacities = computed(() => mapFilters?.state.value?.gasCapacities ?? new Set<string>());
  const activeStatuses = computed(() => mapFilters?.state.value?.gasStatuses ?? new Set<string>());
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Capacity (bcf/y)</span>
      <div class="mt-1 flex flex-col gap-0.5">
        <label
          v-for="opt in capacityOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="activeCapacities.has(opt.id)"
            @update:checked="mapFilters?.toggleGasCapacity(opt.id)"
          />
          <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
          <span class="ml-auto flex gap-0.5">
            <span
              v-for="(dot, i) in 3"
              :key="i"
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: opt.color }"
              aria-hidden="true"
            />
          </span>
        </label>
      </div>
    </div>

    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Status</span>
      <div class="mt-1 flex flex-col gap-0.5">
        <label
          v-for="opt in statusOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="activeStatuses.has(opt.id)"
            @update:checked="mapFilters?.toggleGasStatus(opt.id)"
          />
          <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
