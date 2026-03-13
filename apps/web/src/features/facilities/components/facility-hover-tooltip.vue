<script setup lang="ts">
  import type { FacilityHoverState } from "@/features/facilities/hover.types";

  interface FacilityHoverTooltipProps {
    readonly hoverState: FacilityHoverState | null;
  }

  const props = defineProps<FacilityHoverTooltipProps>();

  function accentColor(): string {
    const style = getComputedStyle(document.documentElement);
    return props.hoverState?.perspective === "hyperscale"
      ? style.getPropertyValue("--hyperscale").trim() || "#10b981"
      : style.getPropertyValue("--colocation").trim() || "#3b82f6";
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
  <aside
    v-if="props.hoverState !== null"
    class="pointer-events-none absolute z-30 rounded-sm p-[2px]"
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
      class="flex w-[min(190px,calc(100vw-2rem))] flex-col gap-[8px] rounded-sm bg-card p-[8px] shadow-[0_4px_8px_rgba(0,0,0,0.06)]"
    >
      <!-- Header: Title + Status + close -->
      <div class="flex items-center justify-between gap-1">
        <div class="flex items-center gap-[4px] overflow-hidden leading-none">
          <span class="truncate text-xs font-semibold" :style="{ color: accentColor() }">
            {{ props.hoverState.facilityName }}
          </span>
          <span class="flex-shrink-0 text-xs text-muted-foreground">{{ statusText() }}</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" class="flex-shrink-0 opacity-40" aria-hidden="true">
          <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
          <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </div>

      <!-- Details -->
      <div class="flex flex-col gap-0 text-xs leading-[1.4] text-muted-foreground">
        <span>{{ props.hoverState.providerName }}</span>
        <span v-if="props.hoverState.leaseOrOwn !== null">{{ props.hoverState.leaseOrOwn }}</span>
      </div>

      <!-- Power metric boxes -->
      <div v-if="powerMetrics().length > 0" class="flex gap-[4px]">
        <div
          v-for="(metric, i) in powerMetrics()"
          :key="i"
          class="flex w-[40px] flex-col items-center gap-[2px] rounded-sm px-[4px] py-[4px]"
          :style="{ backgroundColor: accentColor() }"
        >
          <span class="text-xs leading-none text-white/80">{{ metric.label }}</span>
          <span class="text-xs font-semibold leading-none text-white">{{ metric.value }}</span>
        </div>
      </div>

      <!-- View Details link -->
      <div class="flex items-center gap-[2px]">
        <span class="text-xs" :style="{ color: accentColor() }">View Details</span>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
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
</template>
