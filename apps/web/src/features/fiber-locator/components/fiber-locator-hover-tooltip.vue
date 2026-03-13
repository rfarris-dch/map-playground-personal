<script setup lang="ts">
  import type { FiberLocatorHoverState } from "@/features/fiber-locator/hover.types";

  interface FiberLocatorHoverTooltipProps {
    readonly hoverState: FiberLocatorHoverState | null;
  }

  const props = defineProps<FiberLocatorHoverTooltipProps>();
</script>

<template>
  <aside
    v-if="props.hoverState !== null"
    class="map-glass-surface pointer-events-none absolute z-30 min-w-56 rounded-md p-2"
    :style="{
      left: `${props.hoverState.screenPoint[0] + 12}px`,
      top: `${props.hoverState.screenPoint[1] + 12}px`,
    }"
    aria-label="Fiber hover details"
  >
    <header class="mb-1 flex items-center gap-2">
      <span class="text-xs font-semibold uppercase tracking-wide">
        {{ props.hoverState.lineLabel }}
      </span>
      <span class="text-xs font-mono text-muted-foreground">
        {{ props.hoverState.sourceLayerLabel }}
      </span>
    </header>

    <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs leading-tight">
      <dt class="text-muted-foreground">Source Layer</dt>
      <dd class="m-0 break-words font-mono">{{ props.hoverState.sourceLayerName }}</dd>

      <dt class="text-muted-foreground">Feature</dt>
      <dd class="m-0 font-mono">{{ props.hoverState.featureId }}</dd>

      <template v-if="props.hoverState.segmentName !== null">
        <dt class="text-muted-foreground">Segment</dt>
        <dd class="m-0 break-words">{{ props.hoverState.segmentName }}</dd>
      </template>

      <template v-if="props.hoverState.operatorName !== null">
        <dt class="text-muted-foreground">Operator</dt>
        <dd class="m-0 break-words">{{ props.hoverState.operatorName }}</dd>
      </template>

      <template v-if="props.hoverState.status !== null">
        <dt class="text-muted-foreground">Status</dt>
        <dd class="m-0">{{ props.hoverState.status }}</dd>
      </template>
    </dl>
  </aside>
</template>
