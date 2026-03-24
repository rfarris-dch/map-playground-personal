<script setup lang="ts">
  import { computed } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import {
    countyLabel,
    formatCount,
    formatMarketStructure,
    formatMetric,
    formatShare,
  } from "@/features/county-intelligence/county-intelligence-display.service";
  import type { CountyPowerStoryHoverState } from "@/features/county-power-story/county-power-story.types";

  interface CountyPowerStoryHoverTooltipProps {
    readonly hoverState: CountyPowerStoryHoverState | null;
  }

  const props = defineProps<CountyPowerStoryHoverTooltipProps>();
  const displayState = computed(() => props.hoverState);

  function storyLabel(storyId: CountyPowerStoryHoverState["storyId"]): string {
    if (storyId === "grid-stress") {
      return "Grid Stress Pulse";
    }

    if (storyId === "queue-pressure") {
      return "Queue Pressure Bloom";
    }

    if (storyId === "market-structure") {
      return "Market Structure + Seam";
    }

    return "Policy Watch";
  }
</script>

<template>
  <MapTooltipShell
    ariaLabel="County power story hover details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :offset="{ x: 14, y: 14 }"
  >
    <template v-if="displayState !== null">
      <div class="mb-1.5 flex items-center gap-1.5">
        <span
          class="inline-flex size-1.5 rounded-full"
          :class="{
            'bg-orange-500': displayState.storyId === 'grid-stress',
            'bg-violet-500': displayState.storyId === 'queue-pressure',
            'bg-blue-500': displayState.storyId === 'market-structure',
            'bg-red-500': displayState.storyId === 'policy-watch',
          }"
          aria-hidden="true"
        />
        <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
          {{ storyLabel(displayState.storyId) }}
        </span>
        <span
          class="ml-auto rounded px-1.5 py-px text-[10px] font-semibold uppercase"
          :class="{
            'bg-emerald-500/10 text-emerald-600': displayState.row.band === 'baseline',
            'bg-amber-500/10 text-amber-600': displayState.row.band === 'elevated',
            'bg-orange-500/10 text-orange-600': displayState.row.band === 'high',
            'bg-red-500/10 text-red-600': displayState.row.band === 'extreme',
          }"
        >
          {{ displayState.row.band }}
        </span>
      </div>

      <div class="mb-2 text-sm font-semibold text-foreground/90">
        {{ countyLabel(displayState.row) }}
      </div>

      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-tight">
        <template v-if="displayState.storyId === 'grid-stress'">
          <dt class="text-muted-foreground">Avg RT</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatMetric(displayState.row.avgRtCongestionComponent, 2) }}
          </dd>
          <dt class="text-muted-foreground">P95 shadow</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatMetric(displayState.row.p95ShadowPrice, 2) }}
          </dd>
          <dt class="text-muted-foreground">Neg. price hrs</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatShare(displayState.row.negativePriceHourShare) }}
          </dd>
        </template>

        <template v-else-if="displayState.storyId === 'queue-pressure'">
          <dt class="text-muted-foreground">Queue MW</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatMetric(displayState.row.queueMwActive) }}
          </dd>
          <dt class="text-muted-foreground">Projects</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatCount(displayState.row.queueProjectCountActive) }}
          </dd>
          <dt class="text-muted-foreground">Avg age</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatMetric(displayState.row.queueAvgAgeDays, 0) }}
          </dd>
        </template>

        <template v-else-if="displayState.storyId === 'market-structure'">
          <dt class="text-muted-foreground">Structure</dt>
          <dd class="m-0 text-right font-medium">
            {{ formatMarketStructure(displayState.row.marketStructure) }}
          </dd>
          <dt class="text-muted-foreground">Operator</dt>
          <dd class="m-0 text-right font-medium">
            {{ displayState.row.wholesaleOperator ?? "-" }}
          </dd>
          <dt class="text-muted-foreground">Seam</dt>
          <dd class="m-0 text-right font-medium">
            {{ displayState.row.isSeamCounty ? "Yes" : "No" }}
          </dd>
        </template>

        <template v-else>
          <dt class="text-muted-foreground">Moratorium</dt>
          <dd class="m-0 text-right font-medium">{{ displayState.row.moratoriumStatus ?? "-" }}</dd>
          <dt class="text-muted-foreground">Momentum</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatMetric(displayState.row.policyMomentumScore, 1) }}
          </dd>
          <dt class="text-muted-foreground">Events</dt>
          <dd class="m-0 text-right font-medium tabular-nums">
            {{ formatCount(displayState.row.policyEventCount) }}
          </dd>
        </template>
      </dl>
    </template>
  </MapTooltipShell>
</template>
