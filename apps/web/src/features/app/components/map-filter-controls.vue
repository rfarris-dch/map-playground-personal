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
        class="min-h-[44px] text-xs font-medium text-foreground/65 transition-colors hover:text-foreground/85 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        @click="clearAll"
      >
        Clear all
      </button>
    </div>

    <section class="flex flex-col" role="group" aria-label="Facility status filters">
      <div class="flex h-7 items-center bg-card px-2">
        <span class="text-xs font-normal leading-none text-foreground/70">FACILITY STATUS</span>
      </div>
      <div class="flex flex-col">
        <label
          v-for="opt in statusOptions"
          :key="opt.id"
          class="flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-background focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
          role="checkbox"
          :aria-checked="activeStatuses.has(opt.id)"
        >
          <span
            class="flex size-[14px] shrink-0 items-center justify-center rounded-sm border transition-colors"
            :class="
              activeStatuses.has(opt.id)
                ? 'border-foreground/65 bg-foreground/65'
                : 'border-border bg-white'
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
            class="text-sm leading-none"
            :class="activeStatuses.has(opt.id) ? 'text-foreground/85' : 'text-foreground/70'"
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

    <div class="mx-2 h-px bg-border" />

    <section class="flex flex-col" role="group" aria-label="Provider filters">
      <div class="flex h-7 items-center bg-card px-2">
        <span class="text-xs font-normal leading-none text-foreground/70">PROVIDERS</span>
      </div>
      <div v-if="providers.length > 0" class="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto">
        <label
          v-for="name in providers"
          :key="name"
          class="flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-background focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        >
          <span
            class="flex size-[14px] shrink-0 items-center justify-center rounded-sm border transition-colors"
            :class="
              activeProviders.has(name)
                ? 'border-foreground/65 bg-foreground/65'
                : 'border-border bg-white'
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
            class="truncate text-sm leading-none"
            :class="activeProviders.has(name) ? 'text-foreground/85' : 'text-foreground/70'"
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
        <span class="text-xs italic text-muted-foreground">Zoom in to see providers</span>
      </div>
    </section>

    <div class="mx-2 h-px bg-border" />

    <section class="flex flex-col" role="group" aria-label="Transmission voltage filters">
      <div class="flex h-7 items-center bg-card px-2">
        <span class="text-xs font-normal leading-none text-foreground/70"
          >TRANSMISSION VOLTAGE</span
        >
      </div>
      <div class="flex flex-col">
        <label
          v-for="opt in voltageOptions"
          :key="opt.id"
          class="flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-background focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        >
          <span
            class="flex size-[14px] shrink-0 items-center justify-center rounded-full border transition-colors"
            :class="
              activeVoltageId === opt.id
                ? 'border-foreground/65 bg-foreground/65'
                : 'border-border bg-white'
            "
          >
            <span v-if="activeVoltageId === opt.id" class="size-[6px] rounded-full bg-card" />
          </span>
          <span
            class="text-sm leading-none"
            :class="activeVoltageId === opt.id ? 'text-foreground/85' : 'text-foreground/70'"
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
