<script setup lang="ts">
  import type {
    CountyScoresCoverageResponse,
    CountyScoresResolutionResponse,
  } from "@map-migration/http-contracts/county-intelligence-debug-http";
  import type { SpatialAnalysisCountyScoresStatus } from "@map-migration/http-contracts/spatial-analysis-summary-http";
  import { computed } from "vue";
  import CountyIntelligenceCoverageSummary from "@/features/county-intelligence/components/county-intelligence-coverage-summary.vue";
  import {
    formatDateTime,
    formatFeatureFamily,
  } from "@/features/county-intelligence/county-intelligence-display.service";
  import CountyIntelligenceResolutionSummary from "./county-intelligence-resolution-summary.vue";

  interface CountyScoresDatasetStatusProps {
    readonly coverage: CountyScoresCoverageResponse | null;
    readonly coverageErrorMessage?: string | null;
    readonly coverageLoading?: boolean;
    readonly errorMessage?: string | null;
    readonly isLoading?: boolean;
    readonly resolution: CountyScoresResolutionResponse | null;
    readonly resolutionErrorMessage?: string | null;
    readonly resolutionLoading?: boolean;
    readonly status: SpatialAnalysisCountyScoresStatus | null;
  }

  const props = defineProps<CountyScoresDatasetStatusProps>();

  const availableFeatureFamilies = computed(() => props.status?.availableFeatureFamilies ?? []);
  const missingFeatureFamilies = computed(() => props.status?.missingFeatureFamilies ?? []);
  const statusToneClass = computed(() =>
    props.status?.datasetAvailable
      ? "border-border bg-card text-foreground/70"
      : "border-border bg-background text-muted-foreground"
  );
  const statusLabel = computed(() =>
    props.status?.datasetAvailable ? "Published market-pressure dataset" : "Publication unavailable"
  );
  const confidenceSummary = computed(() => {
    if (props.status === null) {
      return "-";
    }

    return `${props.status.highConfidenceCount} high / ${props.status.mediumConfidenceCount} medium / ${props.status.lowConfidenceCount} low`;
  });
</script>

<template>
  <section
    class="space-y-3 rounded-sm border border-border bg-card p-3 text-muted-foreground shadow-sm"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="m-0 text-xs font-semibold text-foreground/70">Dataset Status</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          Publication metadata, freshness, confidence, and source-family coverage for county market
          pressure.
        </p>
      </div>

      <div
        v-if="props.status !== null"
        class="rounded-sm border px-2.5 py-1 text-xs font-medium shadow-sm"
        :class="statusToneClass"
      >
        {{ statusLabel }}
      </div>
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
      <div v-for="index in 8" :key="index" class="h-16 animate-pulse rounded-sm bg-muted" />
    </div>

    <div v-else-if="props.status !== null" class="space-y-3">
      <p
        class="rounded-sm border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm"
      >
        Feature-family availability below is dataset-level publication metadata, not county-level
        completeness. Use the field coverage and queue resolution sections to explain why specific
        county fields are still null.
      </p>

      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Published</div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">
            {{ formatDateTime(props.status.publishedAt) }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Data Version</div>
          <div class="mt-1 break-all text-sm font-semibold text-foreground/70">
            {{ props.status.dataVersion ?? "-" }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Formula Version</div>
          <div class="mt-1 break-all text-sm font-semibold text-foreground/70">
            {{ props.status.formulaVersion ?? "-" }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Methodology</div>
          <div class="mt-1 break-all text-sm font-semibold text-foreground/70">
            {{ props.status.methodologyId ?? "-" }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Publication Run</div>
          <div class="mt-1 break-all text-xs font-semibold text-foreground/70">
            {{ props.status.publicationRunId ?? "-" }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            Ranked / Deferred / Blocked
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">
            {{ props.status.rankedCountyCount }}
            / {{ props.status.deferredCountyCount }}
            / {{ props.status.blockedCountyCount }}
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Confidence</div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">{{ confidenceSummary }}</div>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Fresh Counties</div>
          <div class="mt-1 text-sm font-semibold text-foreground/70">
            {{ props.status.freshCountyCount }}
            / {{ props.status.sourceCountyCount }}
          </div>
        </div>
      </div>

      <dl class="grid gap-2 text-xs sm:grid-cols-2">
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Input Data</dt>
          <dd class="mt-1 break-all text-xs font-medium text-foreground/70">
            {{ props.status.inputDataVersion ?? "-" }}
          </dd>
        </div>
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Rows Published</dt>
          <dd class="mt-1 text-xs font-medium text-foreground/70">
            {{ props.status.rowCount }}
            current county rows
          </dd>
        </div>
      </dl>

      <div class="grid gap-2 text-xs lg:grid-cols-2">
        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            Published Feature Families
          </div>
          <p class="mt-1 mb-0 text-xs font-medium text-foreground/70">
            {{ availableFeatureFamilies.length > 0
                ? availableFeatureFamilies.map(formatFeatureFamily).join(", ")
                : "-" }}
          </p>
        </div>

        <div class="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            Missing Feature Families
          </div>
          <p class="mt-1 mb-0 text-xs font-medium text-foreground/70">
            {{ missingFeatureFamilies.length > 0
                ? missingFeatureFamilies.map(formatFeatureFamily).join(", ")
                : "None" }}
          </p>
        </div>
      </div>

      <CountyIntelligenceCoverageSummary
        :coverage="props.coverage"
        :error-message="props.coverageErrorMessage ?? null"
        :is-loading="props.coverageLoading ?? false"
      />

      <CountyIntelligenceResolutionSummary
        :resolution="props.resolution"
        :error-message="props.resolutionErrorMessage ?? null"
        :is-loading="props.resolutionLoading ?? false"
      />
    </div>

    <p
      v-else
      class="rounded-sm border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm"
    >
      County market-pressure publication metadata is not available for this selection.
    </p>
  </section>
</template>
