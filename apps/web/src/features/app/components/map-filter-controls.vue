<script setup lang="ts">
  import { computed, inject } from "vue";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";
  import type {
    FacilityStatusFilterId,
    TransmissionVoltageFilterId,
  } from "@/features/app/filters/map-filters.types";

  const mapFilters = inject(MAP_FILTERS_KEY);

  const statusOptions: readonly { id: FacilityStatusFilterId; label: string }[] = [
    { id: "commissioned", label: "Operational / Leased" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
    { id: "unknown", label: "Unknown" },
  ];

  const voltageOptions: readonly { id: TransmissionVoltageFilterId; label: string }[] = [
    { id: "ge-25", label: "25 kV+" },
    { id: "ge-50", label: "50 kV+" },
    { id: "ge-100", label: "100 kV+" },
    { id: "ge-230", label: "230 kV+" },
    { id: "ge-765", label: "765 kV+" },
  ];

  const activeStatuses = computed(() => mapFilters?.state.value?.facilityStatuses ?? new Set());
  const activeProviders = computed(() => mapFilters?.state.value?.facilityProviders ?? new Set());
  const activeVoltage = computed(() => mapFilters?.state.value?.transmissionMinVoltage ?? null);
  const providers = computed(() => mapFilters?.availableProviders.value ?? []);

  const activeVoltageId = computed<TransmissionVoltageFilterId | null>(() => {
    const v = activeVoltage.value;
    if (v === null) {
      return null;
    }
    const entry = voltageOptions.find(
      (opt) =>
        (opt.id === "ge-25" && v === 25_000) ||
        (opt.id === "ge-50" && v === 50_000) ||
        (opt.id === "ge-100" && v === 100_000) ||
        (opt.id === "ge-230" && v === 230_000) ||
        (opt.id === "ge-765" && v === 765_000)
    );
    return entry?.id ?? null;
  });

  const hasActiveFilters = computed(() => {
    return (
      activeStatuses.value.size > 0 ||
      activeProviders.value.size > 0 ||
      activeVoltage.value !== null
    );
  });

  function toggleStatus(id: FacilityStatusFilterId): void {
    mapFilters?.toggleFacilityStatus(id);
  }

  function toggleProvider(name: string): void {
    mapFilters?.toggleFacilityProvider(name);
  }

  function toggleVoltage(id: TransmissionVoltageFilterId): void {
    if (activeVoltageId.value === id) {
      mapFilters?.setTransmissionVoltage(null);
    } else {
      mapFilters?.setTransmissionVoltage(id);
    }
  }

  function clearAll(): void {
    mapFilters?.clearAll();
  }
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="hasActiveFilters" class="flex items-center justify-end px-2 pt-1">
      <button
        type="button"
        class="text-[10px] font-medium text-[#647287] transition-colors hover:text-[#334155]"
        @click="clearAll"
      >
        Clear all
      </button>
    </div>

    <section class="flex flex-col">
      <div class="flex h-7 items-center bg-white px-2">
        <span class="text-[10px] font-normal leading-none text-[#64748B]">FACILITY STATUS</span>
      </div>
      <div class="flex flex-col">
        <label
          v-for="opt in statusOptions"
          :key="opt.id"
          class="flex h-9 cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-[#F8FAFC]"
        >
          <span
            class="flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors"
            :class="
              activeStatuses.has(opt.id)
                ? 'border-[#647287] bg-[#647287]'
                : 'border-[#CBD5E1] bg-white'
            "
          >
            <svg
              v-if="activeStatuses.has(opt.id)"
              class="size-[10px] text-white"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M2 5l2 2 4-4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span
            class="text-[13px] leading-none"
            :class="activeStatuses.has(opt.id) ? 'text-[#334155]' : 'text-[#64748B]'"
            >{{ opt.label }}</span
          >
          <input
            type="checkbox"
            class="sr-only"
            :checked="activeStatuses.has(opt.id)"
            @change="toggleStatus(opt.id)"
          >
        </label>
      </div>
    </section>

    <div class="mx-2 h-px bg-[#E2E8F0]" />

    <section class="flex flex-col">
      <div class="flex h-7 items-center bg-white px-2">
        <span class="text-[10px] font-normal leading-none text-[#64748B]">PROVIDERS</span>
      </div>
      <div v-if="providers.length > 0" class="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto">
        <label
          v-for="name in providers"
          :key="name"
          class="flex h-9 cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-[#F8FAFC]"
        >
          <span
            class="flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors"
            :class="
              activeProviders.has(name)
                ? 'border-[#647287] bg-[#647287]'
                : 'border-[#CBD5E1] bg-white'
            "
          >
            <svg
              v-if="activeProviders.has(name)"
              class="size-[10px] text-white"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M2 5l2 2 4-4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span
            class="truncate text-[13px] leading-none"
            :class="activeProviders.has(name) ? 'text-[#334155]' : 'text-[#64748B]'"
            >{{ name }}</span
          >
          <input
            type="checkbox"
            class="sr-only"
            :checked="activeProviders.has(name)"
            @change="toggleProvider(name)"
          >
        </label>
      </div>
      <div v-else class="px-3 py-2">
        <span class="text-[11px] italic text-[#94A3B8]">Zoom in to see providers</span>
      </div>
    </section>

    <div class="mx-2 h-px bg-[#E2E8F0]" />

    <section class="flex flex-col">
      <div class="flex h-7 items-center bg-white px-2">
        <span class="text-[10px] font-normal leading-none text-[#64748B]"
          >TRANSMISSION VOLTAGE</span
        >
      </div>
      <div class="flex flex-col">
        <label
          v-for="opt in voltageOptions"
          :key="opt.id"
          class="flex h-9 cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-[#F8FAFC]"
        >
          <span
            class="flex size-[14px] shrink-0 items-center justify-center rounded-full border transition-colors"
            :class="
              activeVoltageId === opt.id
                ? 'border-[#647287] bg-[#647287]'
                : 'border-[#CBD5E1] bg-white'
            "
          >
            <span v-if="activeVoltageId === opt.id" class="size-[6px] rounded-full bg-white" />
          </span>
          <span
            class="text-[13px] leading-none"
            :class="activeVoltageId === opt.id ? 'text-[#334155]' : 'text-[#64748B]'"
            >{{ opt.label }}</span
          >
          <input
            type="radio"
            class="sr-only"
            name="voltage"
            :checked="activeVoltageId === opt.id"
            @change="toggleVoltage(opt.id)"
          >
        </label>
      </div>
    </section>
  </div>
</template>
