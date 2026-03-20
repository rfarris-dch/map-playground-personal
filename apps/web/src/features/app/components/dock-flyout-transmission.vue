<script setup lang="ts">
  import { ChevronUp } from "lucide-vue-next";
  import { computed, inject, ref } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";
  import type { TransmissionVoltageFilterId } from "@/features/app/filters/map-filters.types";

  const mapFilters = inject(MAP_FILTERS_KEY);

  interface VoltageOption {
    readonly color: string;
    readonly id: string;
    readonly label: string;
  }

  const voltageOptions: readonly VoltageOption[] = [
    { id: "ge-25", label: "< 25", color: "#1d4ed8" },
    { id: "ge-50", label: "> 25", color: "#1d4ed8" },
    { id: "ge-100", label: "> 100", color: "#f97316" },
    { id: "ge-230", label: "> 230", color: "#dc2626" },
    { id: "ge-765", label: "> 765", color: "#6d28d9" },
  ];

  const VALID_IDS: readonly TransmissionVoltageFilterId[] = [
    "ge-25",
    "ge-50",
    "ge-100",
    "ge-230",
    "ge-765",
  ];

  const activeVoltage = computed<string | null>(() => {
    const v = mapFilters?.state.value?.transmissionMinVoltage ?? null;
    if (v === null) {
      return null;
    }
    if (v === 25_000) {
      return "ge-25";
    }
    if (v === 50_000) {
      return "ge-50";
    }
    if (v === 100_000) {
      return "ge-100";
    }
    if (v === 230_000) {
      return "ge-230";
    }
    if (v === 765_000) {
      return "ge-765";
    }
    return null;
  });

  function isValidId(id: string): id is TransmissionVoltageFilterId {
    return VALID_IDS.includes(id as TransmissionVoltageFilterId);
  }

  function onSelect(id: string): void {
    if (activeVoltage.value === id) {
      mapFilters?.setTransmissionVoltage(null);
      return;
    }
    if (isValidId(id)) {
      mapFilters?.setTransmissionVoltage(id);
    }
  }

  const expanded = ref(false);
</script>

<template>
  <div class="flyout-sections flex flex-col">
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="expanded = !expanded"
      >
        <span class="text-xs font-semibold text-foreground/50">Voltage Range (kV)</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !expanded }"
        />
      </button>
      <div v-if="expanded" class="mt-1 flex flex-col gap-0.5 pl-3">
        <label
          v-for="opt in voltageOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 py-0.5"
        >
          <Checkbox :checked="activeVoltage === opt.id" @update:checked="onSelect(opt.id)" />
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
