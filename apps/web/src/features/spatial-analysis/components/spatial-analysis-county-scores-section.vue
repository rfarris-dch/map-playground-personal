<script setup lang="ts">
  import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/contracts";
  import { computed } from "vue";
  import CountyScoresDatasetStatus from "@/features/county-scores/components/county-scores-dataset-status.vue";

  interface SpatialAnalysisCountyScoresSectionProps {
    readonly countyScores: CountyScoresResponse | null;
    readonly countyScoresStatus: CountyScoresStatusResponse | null;
    readonly errorMessage?: string | null;
    readonly isLoading?: boolean;
    readonly isStatusLoading?: boolean;
    readonly statusErrorMessage?: string | null;
  }

  const props = defineProps<SpatialAnalysisCountyScoresSectionProps>();

  type CountyScoreRow = CountyScoresResponse["rows"][number];

  const rows = computed(() => props.countyScores?.rows ?? []);
  const requestedCountyIds = computed(() => props.countyScores?.summary.requestedCountyIds ?? []);
  const missingCountyIds = computed(() => props.countyScores?.summary.missingCountyIds ?? []);
  const unavailableCountyIds = computed(
    () => props.countyScores?.summary.unavailableCountyIds ?? []
  );
  const hasRows = computed(() => rows.value.length > 0);
  const hasMissingCountyIds = computed(() => missingCountyIds.value.length > 0);
  const hasUnavailableCountyIds = computed(() => unavailableCountyIds.value.length > 0);
  const hasCountySummary = computed(
    () =>
      requestedCountyIds.value.length > 0 ||
      hasRows.value ||
      hasMissingCountyIds.value ||
      hasUnavailableCountyIds.value
  );
  const scoredCountyCount = computed(
    () => rows.value.filter((row) => row.scoreStatus === "scored").length
  );

  function formatScore(value: number | null): string {
    if (value === null || !Number.isFinite(value)) {
      return "-";
    }

    return value.toLocaleString(undefined, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
  }

  function countyLabel(row: CountyScoreRow): string {
    const countyName = row.countyName ?? row.countyFips;
    if (row.stateAbbrev === null) {
      return countyName;
    }

    return `${countyName}, ${row.stateAbbrev}`;
  }
</script>

<template>
  <article class="space-y-3 rounded-xl border border-border/70 bg-background/70 p-4">
    <div class="flex items-center gap-2">
      <span class="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
      <div>
        <h2 class="m-0 text-sm font-semibold">County Intelligence</h2>
        <p class="m-0 text-xs text-muted-foreground">
          Ranked county scores with publication status, provenance, and coverage for the current
          county selection.
        </p>
      </div>
    </div>

    <CountyScoresDatasetStatus
      :status="props.countyScoresStatus"
      :error-message="props.statusErrorMessage ?? null"
      :is-loading="props.isStatusLoading ?? false"
    />

    <p
      v-if="props.errorMessage"
      class="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-900"
    >
      {{ props.errorMessage }}
    </p>

    <div
      v-else-if="props.isLoading"
      class="space-y-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="h-3 w-32 animate-pulse rounded bg-muted" />
      <div class="h-10 animate-pulse rounded-md bg-muted/80" />
      <div class="h-10 animate-pulse rounded-md bg-muted/80" />
      <div class="h-10 animate-pulse rounded-md bg-muted/80" />
    </div>

    <div v-else-if="hasCountySummary" class="space-y-3">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-border/60 bg-card/80 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Selected Counties
          </div>
          <div class="text-lg font-semibold">{{ requestedCountyIds.length }}</div>
        </div>
        <div class="rounded-md border border-border/60 bg-card/80 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Scored Successfully
          </div>
          <div class="text-lg font-semibold">{{ scoredCountyCount }}</div>
        </div>
        <div class="rounded-md border border-border/60 bg-card/80 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Not In Reference Geography
          </div>
          <div class="text-lg font-semibold">{{ missingCountyIds.length }}</div>
        </div>
        <div class="rounded-md border border-border/60 bg-card/80 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Found But Not Scored
          </div>
          <div class="text-lg font-semibold">{{ unavailableCountyIds.length }}</div>
        </div>
      </div>

      <div v-if="hasRows" class="space-y-2">
        <div
          v-for="row in rows"
          :key="row.countyFips"
          class="rounded-md border border-border/60 bg-card/80 px-3 py-3"
        >
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-medium">{{ countyLabel(row) }}</div>
              <div class="text-[11px] text-muted-foreground">FIPS {{ row.countyFips }}</div>
            </div>
            <div class="text-right">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Composite</div>
              <div class="text-lg font-semibold">{{ formatScore(row.compositeScore) }}</div>
              <div
                v-if="row.scoreStatus === 'unavailable'"
                class="text-[10px] text-muted-foreground"
              >
                Score unavailable
              </div>
            </div>
          </div>

          <dl class="grid grid-cols-3 gap-2 text-xs">
            <div class="rounded bg-muted/50 px-2 py-1.5">
              <dt class="text-muted-foreground">Demand</dt>
              <dd class="m-0 font-medium">{{ formatScore(row.demandScore) }}</dd>
            </div>
            <div class="rounded bg-muted/50 px-2 py-1.5">
              <dt class="text-muted-foreground">Generation</dt>
              <dd class="m-0 font-medium">{{ formatScore(row.generationScore) }}</dd>
            </div>
            <div class="rounded bg-muted/50 px-2 py-1.5">
              <dt class="text-muted-foreground">Policy</dt>
              <dd class="m-0 font-medium">{{ formatScore(row.policyScore) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p
        v-if="hasMissingCountyIds"
        class="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950"
      >
        Counties not found in the reference geography: {{ missingCountyIds.join(", ") }}
      </p>

      <p
        v-if="hasUnavailableCountyIds"
        class="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950"
      >
        Counties found in reference geography but missing published scores:
        {{ unavailableCountyIds.join(", ") }}
      </p>
    </div>

    <p v-else class="text-sm text-muted-foreground">
      No county scores are available for this selection.
    </p>
  </article>
</template>
