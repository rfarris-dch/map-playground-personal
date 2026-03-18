<script setup lang="ts">
  import { computed, inject } from "vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";
  import type { TransmissionVoltageFilterId } from "@/features/app/filters/map-filters.types";

  const mapFilters = inject(MAP_FILTERS_KEY);

  interface VoltageOption {
    readonly id: string;
    readonly label: string;
    readonly color: string;
  }

  const voltageOptions: readonly VoltageOption[] = [
    { id: "ge-25", label: "25 kV+", color: "#1d4ed8" },
    { id: "ge-50", label: "50 kV+", color: "#1d4ed8" },
    { id: "ge-100", label: "100 kV+", color: "#f97316" },
    { id: "ge-230", label: "230 kV+", color: "#dc2626" },
    { id: "ge-765", label: "765 kV+", color: "#6d28d9" },
  ];

  const VALID_IDS: readonly TransmissionVoltageFilterId[] = ["ge-25", "ge-50", "ge-100", "ge-230", "ge-765"];

  const activeVoltage = computed<string | null>(() => {
    const v = mapFilters?.state.value?.transmissionMinVoltage ?? null;
    if (v === null) {
      return null;
    }
    if (v === 25_000) return "ge-25";
    if (v === 50_000) return "ge-50";
    if (v === 100_000) return "ge-100";
    if (v === 230_000) return "ge-230";
    if (v === 765_000) return "ge-765";
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
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Minimum Voltage</span>
    <div class="mt-1 flex flex-col gap-0.5">
      <label
        v-for="opt in voltageOptions"
        :key="opt.id"
        class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
      >
        <input
          type="radio"
          name="transmission-voltage"
          class="h-3.5 w-3.5 accent-primary"
          :checked="activeVoltage === opt.id"
          @click="onSelect(opt.id)"
        >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :style="{ backgroundColor: opt.color }"
          aria-hidden="true"
        />
        <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
      </label>
    </div>
  </div>
</template>
