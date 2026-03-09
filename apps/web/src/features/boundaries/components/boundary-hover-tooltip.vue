<script setup lang="ts">
  import type { BoundaryHoverState, BoundaryLayerId } from "@/features/boundaries/boundaries.types";

  interface BoundaryHoverTooltipProps {
    readonly hoverState: BoundaryHoverState | null;
  }

  const props = defineProps<BoundaryHoverTooltipProps>();

  function boundaryLabel(boundaryId: BoundaryLayerId): string {
    if (boundaryId === "county") {
      return "County";
    }

    if (boundaryId === "state") {
      return "State";
    }

    return "Country";
  }

  function formatMegawatts(value: number): string {
    return `${Math.round(value).toLocaleString()} MW`;
  }
</script>

<template>
  <aside
    v-if="props.hoverState !== null"
    class="map-glass-panel-soft pointer-events-none absolute z-30 min-w-56 rounded-md p-2"
    :style="{
      left: `${props.hoverState.screenPoint[0] + 12}px`,
      top: `${props.hoverState.screenPoint[1] + 12}px`,
    }"
    aria-label="Boundary hover details"
  >
    <header class="mb-1 flex items-center gap-2">
      <span class="text-[11px] font-semibold uppercase tracking-wide">
        {{ boundaryLabel(props.hoverState.boundaryId) }}
      </span>
      <span class="text-[11px] text-muted-foreground"> {{ props.hoverState.regionName }} </span>
    </header>

    <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] leading-tight">
      <dt class="text-muted-foreground">Region ID</dt>
      <dd class="m-0 font-mono">{{ props.hoverState.regionId }}</dd>

      <template v-if="props.hoverState.parentRegionName !== null">
        <dt class="text-muted-foreground">Parent</dt>
        <dd class="m-0 break-words">{{ props.hoverState.parentRegionName }}</dd>
      </template>

      <dt class="text-muted-foreground">Commissioned</dt>
      <dd class="m-0">{{ formatMegawatts(props.hoverState.commissionedPowerMw) }}</dd>
    </dl>
  </aside>
</template>
