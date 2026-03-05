<script setup lang="ts">
  import type { PowerHoverState } from "@/features/power/power-hover.types";

  interface PowerHoverTooltipProps {
    readonly hoverState: PowerHoverState | null;
  }

  const props = defineProps<PowerHoverTooltipProps>();

  function formatMegawatts(value: number): string {
    return `${value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 100 ? 0 : 1,
    })} MW`;
  }

  function formatKilovolts(value: number): string {
    return `${value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 100 ? 0 : 1,
    })} kV`;
  }
</script>

<template>
  <aside
    v-if="props.hoverState !== null"
    class="pointer-events-none absolute z-30 min-w-56 rounded-md border border-border/90 bg-card/95 p-2 shadow-md backdrop-blur-sm"
    :style="{
      left: `${props.hoverState.screenPoint[0] + 12}px`,
      top: `${props.hoverState.screenPoint[1] + 12}px`,
    }"
    aria-label="Power hover details"
  >
    <header class="mb-1 flex items-center gap-2">
      <span class="text-[11px] font-semibold uppercase tracking-wide">
        {{ props.hoverState.layerLabel }}
      </span>
      <span
        v-if="props.hoverState.name !== null"
        class="max-w-52 truncate text-[11px] text-muted-foreground"
      >
        {{ props.hoverState.name }}
      </span>
    </header>

    <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] leading-tight">
      <template v-if="props.hoverState.name !== null">
        <dt class="text-muted-foreground">Name</dt>
        <dd class="m-0 break-words">{{ props.hoverState.name }}</dd>
      </template>

      <template v-if="props.hoverState.featureId !== null">
        <dt class="text-muted-foreground">Feature</dt>
        <dd class="m-0 font-mono">{{ props.hoverState.featureId }}</dd>
      </template>

      <template v-if="props.hoverState.operatorName !== null">
        <dt class="text-muted-foreground">Operator</dt>
        <dd class="m-0 break-words">{{ props.hoverState.operatorName }}</dd>
      </template>

      <template v-if="props.hoverState.status !== null">
        <dt class="text-muted-foreground">Status</dt>
        <dd class="m-0">{{ props.hoverState.status }}</dd>
      </template>

      <template v-if="props.hoverState.sourceDetail !== null">
        <dt class="text-muted-foreground">Source</dt>
        <dd class="m-0 break-words">{{ props.hoverState.sourceDetail }}</dd>
      </template>

      <template v-if="props.hoverState.outputMw !== null">
        <dt class="text-muted-foreground">Output</dt>
        <dd class="m-0">{{ formatMegawatts(props.hoverState.outputMw) }}</dd>
      </template>

      <template v-if="props.hoverState.voltageKv !== null">
        <dt class="text-muted-foreground">Voltage</dt>
        <dd class="m-0">{{ formatKilovolts(props.hoverState.voltageKv) }}</dd>
      </template>

      <template v-if="props.hoverState.sourceLayerName !== null">
        <dt class="text-muted-foreground">Source Layer</dt>
        <dd class="m-0 font-mono">{{ props.hoverState.sourceLayerName }}</dd>
      </template>
    </dl>
  </aside>
</template>
