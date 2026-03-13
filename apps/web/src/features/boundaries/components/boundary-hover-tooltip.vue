<script setup lang="ts">
  import { toRef } from "vue";
  import { useTooltipPosition } from "@/composables/use-tooltip-position";
  import type { BoundaryHoverState, BoundaryLayerId } from "@/features/boundaries/boundaries.types";

  interface BoundaryHoverTooltipProps {
    readonly hoverState: BoundaryHoverState | null;
  }

  const props = defineProps<BoundaryHoverTooltipProps>();

  const screenPoint = toRef(() => props.hoverState?.screenPoint ?? null);
  const { style: positionStyle } = useTooltipPosition(screenPoint, { x: 12, y: 12 });

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
  <Transition
    enter-active-class="transition-opacity duration-100"
    enter-from-class="opacity-0"
  >
  <aside
    v-if="props.hoverState !== null"
    class="map-glass-surface pointer-events-none absolute z-30 min-w-56 rounded-md p-2"
    :style="positionStyle"
    aria-label="Boundary hover details"
  >
    <header class="mb-1 flex items-center gap-2">
      <span class="text-xs font-semibold uppercase tracking-wide">
        {{ boundaryLabel(props.hoverState.boundaryId) }}
      </span>
      <span class="text-xs text-muted-foreground"> {{ props.hoverState.regionName }} </span>
    </header>

    <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs leading-tight">
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
  </Transition>
</template>
