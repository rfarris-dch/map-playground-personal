<script setup lang="ts">
  import { ChevronUp } from "lucide-vue-next";
  import { computed, inject, ref } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";

  const mapFilters = inject(MAP_FILTERS_KEY);

  interface ColoredOption {
    readonly color: string;
    readonly id: string;
    readonly label: string;
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

  const activeCapacities = computed(
    () => mapFilters?.state.value?.gasCapacities ?? new Set<string>()
  );
  const activeStatuses = computed(() => mapFilters?.state.value?.gasStatuses ?? new Set<string>());

  const capacityExpanded = ref(false);
  const statusExpanded = ref(false);
</script>

<template>
  <div class="flyout-sections flex flex-col">
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="capacityExpanded = !capacityExpanded"
      >
        <span class="text-xs font-semibold text-foreground/50">Capacity (bcf/y)</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !capacityExpanded }"
        />
      </button>
      <div v-if="capacityExpanded" class="mt-1 flex flex-col gap-0.5 pl-3">
        <label
          v-for="opt in capacityOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox
            :checked="activeCapacities.has(opt.id)"
            @update:checked="mapFilters?.toggleGasCapacity(opt.id)"
          />
          <span class="min-w-0 flex-1 truncate text-[10px] text-foreground/50"
            >{{ opt.label }}</span
          >
          <span
            class="h-[2px] w-5 shrink-0 rounded-full"
            :style="{ backgroundColor: opt.color }"
            aria-hidden="true"
          />
        </label>
      </div>
    </div>

    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="statusExpanded = !statusExpanded"
      >
        <span class="text-xs font-semibold text-foreground/50">Status</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !statusExpanded }"
        />
      </button>
      <div v-if="statusExpanded" class="mt-1 flex flex-col gap-0.5 pl-2">
        <label
          v-for="opt in statusOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox
            :checked="activeStatuses.has(opt.id)"
            @update:checked="mapFilters?.toggleGasStatus(opt.id)"
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
