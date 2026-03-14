<script setup lang="ts">
  import { computed } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import type { PowerHoverState } from "@/features/power/power-hover.types";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface PowerHoverTooltipProps {
    readonly hoverState: PowerHoverState | null;
  }

  const props = defineProps<PowerHoverTooltipProps>();
  const displayState = computed(() => props.hoverState);

  function formatKilovolts(value: number): string {
    return `${value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 100 ? 0 : 1,
    })} kV`;
  }
</script>

<template>
  <MapTooltipShell
    ariaLabel="Power hover details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :offset="{ x: 12, y: 12 }"
  >
    <template v-if="displayState !== null">
      <header class="mb-1 flex items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide">
          {{ displayState.layerLabel }}
        </span>
        <span
          v-if="displayState.name !== null"
          class="max-w-52 truncate text-xs text-muted-foreground"
        >
          {{ displayState.name }}
        </span>
      </header>

      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs leading-tight">
        <template v-if="displayState.name !== null">
          <dt class="text-muted-foreground">Name</dt>
          <dd class="m-0 break-words">{{ displayState.name }}</dd>
        </template>

        <template v-if="displayState.operatorName !== null">
          <dt class="text-muted-foreground">Operator</dt>
          <dd class="m-0 break-words">{{ displayState.operatorName }}</dd>
        </template>

        <template v-if="displayState.status !== null">
          <dt class="text-muted-foreground">Status</dt>
          <dd class="m-0">{{ displayState.status }}</dd>
        </template>

        <template v-if="displayState.sourceDetail !== null">
          <dt class="text-muted-foreground">Source</dt>
          <dd class="m-0 break-words">{{ displayState.sourceDetail }}</dd>
        </template>

        <template v-if="displayState.outputMw !== null">
          <dt class="text-muted-foreground">Output</dt>
          <dd class="m-0">{{ formatMegawatts(displayState.outputMw) }}</dd>
        </template>

        <template v-if="displayState.voltageKv !== null">
          <dt class="text-muted-foreground">Voltage</dt>
          <dd class="m-0">{{ formatKilovolts(displayState.voltageKv) }}</dd>
        </template>
      </dl>
    </template>
  </MapTooltipShell>
</template>
