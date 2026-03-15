<script setup lang="ts">
  import { computed } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import type { BoundaryHoverState, BoundaryLayerId } from "@/features/boundaries/boundaries.types";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface BoundaryHoverTooltipProps {
    readonly hoverState: BoundaryHoverState | null;
  }

  const props = defineProps<BoundaryHoverTooltipProps>();
  const displayState = computed(() => props.hoverState);

  function boundaryLabel(boundaryId: BoundaryLayerId): string {
    if (boundaryId === "county") {
      return "County";
    }

    if (boundaryId === "state") {
      return "State";
    }

    return "Country";
  }
</script>

<template>
  <MapTooltipShell
    ariaLabel="Boundary hover details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :offset="{ x: 12, y: 12 }"
  >
    <template v-if="displayState !== null">
      <header class="mb-1 flex items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide">
          {{ boundaryLabel(displayState.boundaryId) }}
        </span>
        <span class="text-xs text-muted-foreground"> {{ displayState.regionName }} </span>
      </header>

      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs leading-tight">
        <template v-if="displayState.parentRegionName !== null">
          <dt class="text-muted-foreground">Parent</dt>
          <dd class="m-0 break-words">{{ displayState.parentRegionName }}</dd>
        </template>

        <dt class="text-muted-foreground">Commissioned</dt>
        <dd class="m-0">
          {{ formatMegawatts(displayState.commissionedPowerMw, { maximumFractionDigits: 0 }) }}
        </dd>
      </dl>
    </template>
  </MapTooltipShell>
</template>
