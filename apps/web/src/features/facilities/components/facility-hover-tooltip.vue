<script setup lang="ts">
  import type { FacilityHoverState } from "@/features/facilities/hover.types";

  interface FacilityHoverTooltipProps {
    readonly hoverState: FacilityHoverState | null;
  }

  const props = defineProps<FacilityHoverTooltipProps>();

  function accentColor(): string {
    return props.hoverState?.perspective === "hyperscale" ? "#10b981" : "#3b82f6";
  }

  function formatMw(value: number | null): string {
    if (value === null || value === 0) {
      return "—";
    }
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  }

  function statusText(): string {
    if (!props.hoverState) {
      return "";
    }
    return props.hoverState.statusLabel ?? props.hoverState.commissionedSemantic;
  }

  interface PowerMetric {
    label: string;
    value: string;
  }

  function powerMetrics(): PowerMetric[] {
    if (!props.hoverState) {
      return [];
    }
    const metrics: PowerMetric[] = [];
    if (props.hoverState.commissionedPowerMw !== null) {
      metrics.push({ label: "Comm.", value: formatMw(props.hoverState.commissionedPowerMw) });
    }
    if (props.hoverState.underConstructionPowerMw !== null) {
      metrics.push({ label: "UC", value: formatMw(props.hoverState.underConstructionPowerMw) });
    }
    if (props.hoverState.plannedPowerMw !== null) {
      metrics.push({ label: "Plan.", value: formatMw(props.hoverState.plannedPowerMw) });
    }
    if (props.hoverState.availablePowerMw !== null) {
      metrics.push({ label: "Avail.", value: formatMw(props.hoverState.availablePowerMw) });
    }
    return metrics;
  }
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-100"
    enter-from-class="opacity-0"
  >
  <aside
    v-if="props.hoverState !== null"
    class="pointer-events-none absolute z-30 rounded-[4px] p-[2px]"
    :style="{
      left: `${props.hoverState.screenPoint[0] + 14}px`,
      top: `${props.hoverState.screenPoint[1] + 14}px`,
      borderWidth: '0.5px',
      borderStyle: 'solid',
      borderColor: accentColor(),
    }"
    aria-label="Facility hover details"
  >
    <div
      class="flex w-[190px] flex-col gap-[8px] rounded-[4px] bg-white p-[8px] shadow-[0_4px_8px_rgba(0,0,0,0.06)]"
    >
      <!-- Header: Title + Status + close -->
      <div class="flex items-center justify-between gap-1">
        <div class="flex items-center gap-[4px] overflow-hidden leading-none">
          <span class="truncate text-[10px] font-semibold" :style="{ color: accentColor() }">
            {{ props.hoverState.facilityName }}
          </span>
          <span class="flex-shrink-0 text-[8px] text-[#94a3b8]">{{ statusText() }}</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" class="flex-shrink-0 opacity-40">
          <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" stroke="#94a3b8" stroke-width="1.2" />
          <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" stroke="#94a3b8" stroke-width="1.2" />
        </svg>
      </div>

      <!-- Details -->
      <div class="flex flex-col gap-0 text-[8px] leading-[1.4] text-[#94a3b8]">
        <span>{{ props.hoverState.providerName }}</span>
        <span v-if="props.hoverState.leaseOrOwn !== null">{{ props.hoverState.leaseOrOwn }}</span>
      </div>

      <!-- Power metric boxes -->
      <div v-if="powerMetrics().length > 0" class="flex gap-[4px]">
        <div
          v-for="(metric, i) in powerMetrics()"
          :key="i"
          class="flex w-[40px] flex-col items-center gap-[2px] rounded-[4px] px-[4px] py-[4px]"
          :style="{ backgroundColor: accentColor() }"
        >
          <span class="text-[8px] leading-none text-white/80">{{ metric.label }}</span>
          <span class="text-[8px] font-semibold leading-none text-white">{{ metric.value }}</span>
        </div>
      </div>

      <!-- View Details link -->
      <div class="flex items-center gap-[2px]">
        <span class="text-[8px]" :style="{ color: accentColor() }">View Details</span>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M6 4l4 4-4 4"
            fill="none"
            :stroke="accentColor()"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
  </aside>
  </Transition>
</template>
