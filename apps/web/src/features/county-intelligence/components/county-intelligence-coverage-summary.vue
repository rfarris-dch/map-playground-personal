<script setup lang="ts">
  import type { CountyScoresCoverageResponse } from "@map-migration/http-contracts/county-intelligence-http";
  import { computed } from "vue";
  import {
    formatCoverageCount,
    formatCoverageFieldLabel,
    formatCoveragePercent,
  } from "@/features/county-intelligence/county-intelligence-display.service";

  interface CountyIntelligenceCoverageSummaryProps {
    readonly coverage: CountyScoresCoverageResponse | null;
    readonly errorMessage?: string | null;
    readonly isLoading?: boolean;
  }

  const props = defineProps<CountyIntelligenceCoverageSummaryProps>();

  const coverageFields = computed(() => props.coverage?.fields ?? []);
</script>

<template>
  <section class="space-y-2">
    <div>
      <h4 class="m-0 text-xs font-semibold text-foreground/70">Field Coverage</h4>
      <p class="mt-1 text-xs text-muted-foreground">
        County-level completeness for the key diagnostic fields. This is the reliable complement to
        dataset-family availability.
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
      class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div v-for="index in 7" :key="index" class="h-16 animate-pulse rounded-sm bg-muted" />
    </div>

    <div v-else-if="coverageFields.length > 0" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="field in coverageFields"
        :key="field.fieldName"
        class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ formatCoverageFieldLabel(field.fieldName) }}
        </div>
        <div class="mt-1 text-sm font-semibold text-foreground/70">
          {{ formatCoverageCount(field.populatedCount, field.totalCount) }}
        </div>
        <div class="mt-0.5 text-xs text-muted-foreground">
          {{ formatCoveragePercent(field.populatedCount, field.totalCount) }}
          populated
        </div>
      </div>
    </div>
  </section>
</template>
