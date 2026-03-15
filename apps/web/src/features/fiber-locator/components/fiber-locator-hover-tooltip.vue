<script setup lang="ts">
  import { computed } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import type { FiberLocatorHoverState } from "@/features/fiber-locator/hover.types";

  interface FiberLocatorHoverTooltipProps {
    readonly hoverState: FiberLocatorHoverState | null;
  }

  const props = defineProps<FiberLocatorHoverTooltipProps>();
  const displayState = computed(() => props.hoverState);
</script>

<template>
  <MapTooltipShell
    ariaLabel="Fiber hover details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :offset="{ x: 12, y: 12 }"
  >
    <template v-if="displayState !== null">
      <header class="mb-1 flex items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide">
          {{ displayState.lineLabel }}
        </span>
        <span class="text-xs font-mono text-muted-foreground">
          {{ displayState.sourceLayerLabel }}
        </span>
      </header>

      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs leading-tight">
        <template v-if="displayState.segmentName !== null">
          <dt class="text-muted-foreground">Segment</dt>
          <dd class="m-0 break-words">{{ displayState.segmentName }}</dd>
        </template>

        <template v-if="displayState.operatorName !== null">
          <dt class="text-muted-foreground">Operator</dt>
          <dd class="m-0 break-words">{{ displayState.operatorName }}</dd>
        </template>

        <template v-if="displayState.status !== null">
          <dt class="text-muted-foreground">Status</dt>
          <dd class="m-0">{{ displayState.status }}</dd>
        </template>
      </dl>
    </template>
  </MapTooltipShell>
</template>
