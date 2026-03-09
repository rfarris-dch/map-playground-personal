<script setup lang="ts">
  import type { FacilityHoverState } from "@/features/facilities/hover.types";

  interface FacilityHoverTooltipProps {
    readonly hoverState: FacilityHoverState | null;
  }

  const props = defineProps<FacilityHoverTooltipProps>();

  function formatNullableMw(value: number | null): string {
    if (value === null) {
      return "n/a";
    }

    return `${value.toLocaleString()} MW`;
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
    aria-label="Facility hover details"
  >
    <header class="mb-1 flex items-center gap-2">
      <span class="text-[11px] font-semibold uppercase tracking-wide">
        {{ props.hoverState.perspective }}
      </span>
      <span class="truncate text-[11px] font-medium">{{ props.hoverState.facilityName }}</span>
    </header>

    <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] leading-tight">
      <dt class="text-muted-foreground">Provider</dt>
      <dd class="m-0 break-words">{{ props.hoverState.providerName }}</dd>

      <dt class="text-muted-foreground">Semantic</dt>
      <dd class="m-0">{{ props.hoverState.commissionedSemantic }}</dd>

      <dt class="text-muted-foreground">Commissioned</dt>
      <dd class="m-0">{{ formatNullableMw(props.hoverState.commissionedPowerMw) }}</dd>

      <template v-if="props.hoverState.leaseOrOwn !== null">
        <dt class="text-muted-foreground">Lease / Own</dt>
        <dd class="m-0">{{ props.hoverState.leaseOrOwn }}</dd>
      </template>
    </dl>
  </aside>
</template>
