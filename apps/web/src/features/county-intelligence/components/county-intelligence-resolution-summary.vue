<script setup lang="ts">
  import type { CountyScoresResolutionResponse } from "@map-migration/http-contracts/county-intelligence-debug-http";
  import { computed } from "vue";
  import {
    formatCount,
    formatDateTime,
    formatSourceSystem,
  } from "@/features/county-intelligence/county-intelligence-display.service";

  interface CountyIntelligenceResolutionSummaryProps {
    readonly errorMessage?: string | null;
    readonly isLoading?: boolean;
    readonly resolution: CountyScoresResolutionResponse | null;
  }

  const props = defineProps<CountyIntelligenceResolutionSummaryProps>();

  const bySource = computed(() => props.resolution?.bySource ?? []);

  function sampleLabelsForSource(source: CountyScoresResolutionResponse["bySource"][number]) {
    const snapshotLabels =
      source.sampleSnapshotPoiLabels.length > 0
        ? source.sampleSnapshotPoiLabels
        : source.sampleSnapshotLocationLabels;
    if (snapshotLabels.length > 0) {
      return snapshotLabels;
    }

    if (source.samplePoiLabels.length > 0) {
      return source.samplePoiLabels;
    }

    return source.sampleLocationLabels;
  }
</script>

<template>
  <section class="space-y-2">
    <div>
      <h4 class="m-0 text-xs font-semibold text-foreground/70">Queue Resolution</h4>
      <p class="mt-1 text-xs text-muted-foreground">
        Unresolved queue tails are source-level precision gaps, not county-level silent failures.
      </p>
    </div>

    <p
      v-if="props.errorMessage"
      class="rounded-sm border border-[var(--error)]/20 bg-[var(--error)]/5 px-3 py-2 text-xs text-[var(--error)]"
    >
      {{ props.errorMessage }}
    </p>

    <div
      v-else-if="props.isLoading"
      class="grid gap-2 sm:grid-cols-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div v-for="index in 6" :key="index" class="h-16 animate-pulse rounded-sm bg-muted" />
    </div>

    <div v-else-if="props.resolution !== null" class="space-y-2">
      <div class="grid gap-2 sm:grid-cols-3">
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            Resolution Snapshot
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">
            {{ formatDateTime(props.resolution.effectiveDate) }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            Unresolved Projects
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">
            {{ formatCount(props.resolution.unresolvedProjectCount) }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            Unresolved Snapshots
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">
            {{ formatCount(props.resolution.unresolvedSnapshotCount) }}
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <div
          v-for="source in bySource"
          :key="source.sourceSystem"
          class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-xs font-semibold text-foreground/70">
                {{ formatSourceSystem(source.sourceSystem) }}
              </div>
              <p class="mt-1 mb-0 text-xs text-muted-foreground">
                {{ formatCount(source.unresolvedProjects) }}
                unresolved projects /
                {{ formatCount(source.unresolvedSnapshots) }}
                unresolved snapshots
              </p>
            </div>
            <div class="text-right text-xs text-muted-foreground">
              <div>Direct {{ formatCount(source.directResolutionCount) }}</div>
              <div>Derived {{ formatCount(source.derivedResolutionCount) }}</div>
              <div>Manual {{ formatCount(source.manualResolutionCount) }}</div>
              <div>Low confidence {{ formatCount(source.lowConfidenceResolutionCount) }}</div>
            </div>
          </div>

          <p
            v-if="sampleLabelsForSource(source).length > 0"
            class="mt-2 mb-0 text-xs text-foreground/70"
          >
            Samples:
            {{ sampleLabelsForSource(source).join(", ") }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
