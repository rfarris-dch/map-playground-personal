<script setup lang="ts">
  import type { MarketBoundaryHoverState } from "@/features/market-boundaries/market-boundaries.types";

  interface MarketBoundaryHoverTooltipProps {
    readonly hover: MarketBoundaryHoverState | null;
  }

  const props = defineProps<MarketBoundaryHoverTooltipProps>();

  function formatMegawatts(value: number | null): string {
    if (value === null) {
      return "N/A";
    }

    return `${Math.round(value).toLocaleString()} MW`;
  }

  function formatPercent(value: number | null): string {
    if (value === null) {
      return "N/A";
    }

    return `${(value * 100).toFixed(1)}%`;
  }

  function formatAbsorption(value: number | null): string {
    if (value === null) {
      return "N/A";
    }

    return `${Math.round(value).toLocaleString()} MW`;
  }
</script>

<template>
  <div
    v-if="props.hover !== null"
    class="pointer-events-none fixed z-50 rounded-sm border border-border bg-card px-3 py-2 shadow-md"
    :style="{
      left: `${props.hover.screenPoint[0] + 12}px`,
      top: `${props.hover.screenPoint[1] - 12}px`,
    }"
  >
    <p class="text-xs font-semibold text-foreground/85">{{ props.hover.regionName }}</p>
    <p v-if="props.hover.parentRegionName" class="text-xs text-muted-foreground">
      {{ props.hover.parentRegionName }}
    </p>
    <div class="mt-1 grid gap-0.5 text-xs text-muted-foreground">
      <p v-if="props.hover.commissionedPowerMw !== null">
        Power: {{ formatMegawatts(props.hover.commissionedPowerMw) }}
      </p>
      <p v-if="props.hover.vacancy !== null">Vacancy: {{ formatPercent(props.hover.vacancy) }}</p>
      <p v-if="props.hover.absorption !== null">
        Absorption: {{ formatAbsorption(props.hover.absorption) }}
      </p>
    </div>
  </div>
</template>
