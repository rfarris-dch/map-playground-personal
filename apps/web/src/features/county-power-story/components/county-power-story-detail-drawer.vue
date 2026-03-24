<script setup lang="ts">
  import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";
  import { computed } from "vue";
  import EntityDetailDrawerShell from "@/components/map/entity-detail-drawer-shell.vue";
  import {
    countyLabel,
    formatDateTime,
    formatMetric,
  } from "@/features/county-intelligence/county-intelligence-display.service";
  import type { CountyPowerStorySelectionState } from "@/features/county-power-story/county-power-story.types";
  import CountyPowerContextPanel from "@/features/spatial-analysis/components/county-power-context-panel.vue";

  interface CountyPowerStoryDetailDrawerProps {
    readonly detailRow: CountyScore | null;
    readonly errorMessage: string | null;
    readonly isLoading: boolean;
    readonly selectedCounty: CountyPowerStorySelectionState | null;
  }

  const props = defineProps<CountyPowerStoryDetailDrawerProps>();

  const emit = defineEmits<{
    close: [];
  }>();

  function storyLabel(storyId: CountyPowerStorySelectionState["storyId"]): string {
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

  const title = computed(() => {
    if (props.detailRow !== null) {
      return countyLabel(props.detailRow);
    }

    if (props.selectedCounty === null) {
      return "County power story";
    }

    const countyName = props.selectedCounty.countyName ?? props.selectedCounty.countyFips;
    return props.selectedCounty.stateAbbrev === null
      ? countyName
      : `${countyName}, ${props.selectedCounty.stateAbbrev}`;
  });
</script>

<template>
  <EntityDetailDrawerShell
    ariaLabel="County power story detail"
    :selected="props.selectedCounty"
    eyebrow="County story"
    :title="title"
    :is-loading="props.isLoading"
    :is-error="props.errorMessage !== null"
    loading-message="Loading county intelligence detail..."
    :error-message="props.errorMessage ?? 'County intelligence detail failed to load.'"
    @close="emit('close')"
  >
    <template v-if="props.selectedCounty !== null">
      <div class="mb-4 flex items-center gap-2">
        <span
          class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          :class="{
            'bg-orange-500/10 text-orange-600': props.selectedCounty.storyId === 'grid-stress',
            'bg-violet-500/10 text-violet-600': props.selectedCounty.storyId === 'queue-pressure',
            'bg-blue-500/10 text-blue-600': props.selectedCounty.storyId === 'market-structure',
            'bg-red-500/10 text-red-600': props.selectedCounty.storyId === 'policy-watch',
          }"
        >
          {{ storyLabel(props.selectedCounty.storyId) }}
        </span>
        <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {{ props.selectedCounty.window.toUpperCase() }}
        </span>
        <span v-if="props.detailRow !== null" class="ml-auto text-[10px] text-muted-foreground">
          Updated {{ formatDateTime(props.detailRow.lastUpdatedAt) }}
        </span>
      </div>

      <section v-if="props.detailRow !== null" class="space-y-4">
        <div
          v-if="props.detailRow.narrativeSummary"
          class="rounded-md border-l-2 border-foreground/10 bg-foreground/[0.02] py-2 pl-3 pr-2"
        >
          <p class="mb-0 text-[13px] leading-relaxed text-foreground/75">
            {{ props.detailRow.narrativeSummary }}
          </p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="metric-card rounded-lg p-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pressure
            </div>
            <div class="mt-1 text-lg font-bold tabular-nums text-foreground/90">
              {{ formatMetric(props.detailRow.marketPressureIndex) }}
            </div>
          </div>
          <div class="metric-card rounded-lg p-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Freshness
            </div>
            <div class="mt-1 text-lg font-bold tabular-nums text-foreground/90">
              {{ formatMetric(props.detailRow.freshnessScore) }}
            </div>
          </div>
          <div class="metric-card rounded-lg p-2.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Queue MW
            </div>
            <div class="mt-1 text-lg font-bold tabular-nums text-foreground/90">
              {{ formatMetric(props.detailRow.queueMwActive) }}
            </div>
          </div>
        </div>

        <section class="border-t border-border/40 pt-4">
          <CountyPowerContextPanel :row="props.detailRow" />
        </section>
      </section>
    </template>
  </EntityDetailDrawerShell>
</template>

<style scoped>
  .metric-card {
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.04) 100%);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
</style>
