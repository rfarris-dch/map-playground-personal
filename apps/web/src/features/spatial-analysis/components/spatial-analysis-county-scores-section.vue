<script setup lang="ts">
  import type {
    CountyScoresResponse,
    CountyScoresStatusResponse,
  } from "@map-migration/http-contracts/county-intelligence-http";
  import { computed } from "vue";
  import CountyScoresDatasetStatus from "@/features/county-intelligence/components/county-intelligence-dataset-status.vue";
  import {
    confidenceToneClass,
    countyLabel,
    formatCount,
    formatDateTime,
    formatDeferredReason,
    formatMetric,
    formatRankStatus,
    formatShare,
    formatTier,
    rankToneClass,
  } from "@/features/county-intelligence/county-intelligence-display.service";

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
  const deferredCountyIds = computed(() => props.countyScores?.summary.deferredCountyIds ?? []);
  const blockedCountyIds = computed(() => props.countyScores?.summary.blockedCountyIds ?? []);
  const hasRows = computed(() => rows.value.length > 0);
  const hasMissingCountyIds = computed(() => missingCountyIds.value.length > 0);
  const hasCountySummary = computed(
    () =>
      requestedCountyIds.value.length > 0 ||
      hasRows.value ||
      missingCountyIds.value.length > 0 ||
      deferredCountyIds.value.length > 0 ||
      blockedCountyIds.value.length > 0
  );
  const rankedCountyCount = computed(
    () => rows.value.filter((row) => row.rankStatus === "ranked").length
  );

  function visibleChanges(
    row: CountyScoreRow
  ): readonly CountyScoreRow["whatChanged30d"][number][] {
    if (row.whatChanged30d.length > 0) {
      return row.whatChanged30d;
    }

    if (row.whatChanged60d.length > 0) {
      return row.whatChanged60d;
    }

    return row.whatChanged90d;
  }
</script>

<template>
  <article class="space-y-4 text-muted-foreground">
    <div class="flex items-center gap-2">
      <span class="inline-block h-2 w-2 rounded-full bg-sky-500" />
      <div>
        <h2 class="m-0 text-xs font-semibold text-foreground/70">County Market Pressure</h2>
        <p class="m-0 text-xs text-muted-foreground">
          County-first market-pressure triage with demand, supply timeline, grid friction, policy,
          confidence, and deferred-state detail.
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
      class="rounded-sm border border-[var(--error)]/20 bg-[var(--error)]/5 px-3 py-2 text-xs text-[var(--error)]"
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
      <div class="h-3 w-40 animate-pulse rounded bg-muted" />
      <div class="h-28 animate-pulse rounded-sm bg-muted" />
      <div class="h-28 animate-pulse rounded-sm bg-muted" />
    </div>

    <div v-else-if="hasCountySummary" class="space-y-4">
      <!-- Summary counters — flat, no card wrappers -->
      <div class="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <div class="uppercase tracking-wide text-muted-foreground">Selected Counties</div>
          <div class="text-lg font-semibold text-foreground/70">
            {{ requestedCountyIds.length }}
          </div>
        </div>
        <div>
          <div class="uppercase tracking-wide text-muted-foreground">Ranked</div>
          <div class="text-lg font-semibold text-foreground/70">{{ rankedCountyCount }}</div>
        </div>
        <div>
          <div class="uppercase tracking-wide text-muted-foreground">Deferred</div>
          <div class="text-lg font-semibold text-foreground/70">{{ deferredCountyIds.length }}</div>
        </div>
        <div>
          <div class="uppercase tracking-wide text-muted-foreground">Blocked</div>
          <div class="text-lg font-semibold text-foreground/70">{{ blockedCountyIds.length }}</div>
        </div>
        <div>
          <div class="uppercase tracking-wide text-muted-foreground">Missing Geography</div>
          <div class="text-lg font-semibold text-foreground/70">{{ missingCountyIds.length }}</div>
        </div>
      </div>

      <!-- County rows -->
      <div v-if="hasRows" class="space-y-6">
        <div
          v-for="row in rows"
          :key="row.countyFips"
          class="space-y-3 border-t border-border/60 pt-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-foreground/70">{{ countyLabel(row) }}</div>
              <div class="text-xs text-muted-foreground">FIPS {{ row.countyFips }}</div>
            </div>

            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span
                class="rounded-sm border px-2.5 py-1 font-medium"
                :class="rankToneClass(row.rankStatus)"
              >
                {{ formatRankStatus(row.rankStatus) }}
              </span>
              <span
                class="rounded-sm border px-2.5 py-1 font-medium"
                :class="confidenceToneClass(row.confidenceBadge)"
              >
                {{ row.confidenceBadge.toUpperCase() }}
                confidence
              </span>
            </div>
          </div>

          <!-- Key scores — flat row -->
          <div class="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-sm bg-background px-2 py-1.5">
              <div class="uppercase tracking-wide text-muted-foreground">Pressure Index</div>
              <div class="text-sm font-semibold text-foreground/70">
                {{ formatMetric(row.marketPressureIndex) }}
              </div>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <div class="uppercase tracking-wide text-muted-foreground">Tier</div>
              <div class="text-sm font-semibold text-foreground/70">
                {{ formatTier(row.attractivenessTier) }}
              </div>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <div class="uppercase tracking-wide text-muted-foreground">Freshness</div>
              <div class="text-sm font-semibold text-foreground/70">
                {{ formatMetric(row.freshnessScore) }}
              </div>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <div class="uppercase tracking-wide text-muted-foreground">Updated</div>
              <div class="text-sm font-semibold text-foreground/70">
                {{ formatDateTime(row.lastUpdatedAt) }}
              </div>
            </div>
          </div>

          <!-- Narrative -->
          <div class="text-xs">
            <div class="uppercase tracking-wide text-muted-foreground">Narrative</div>
            <p class="mt-1 mb-0 text-foreground/70">
              {{ row.narrativeSummary ?? "No county narrative is available." }}
            </p>
          </div>

          <!-- Score breakdown — flat row -->
          <dl class="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-sm bg-background px-2 py-1.5">
              <dt class="text-muted-foreground">Demand Pressure</dt>
              <dd class="m-0 font-medium text-foreground/70">
                {{ formatMetric(row.demandPressureScore) }}
              </dd>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <dt class="text-muted-foreground">Supply Timeline</dt>
              <dd class="m-0 font-medium text-foreground/70">
                {{ formatMetric(row.supplyTimelineScore) }}
              </dd>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <dt class="text-muted-foreground">Grid Friction</dt>
              <dd class="m-0 font-medium text-foreground/70">
                {{ formatMetric(row.gridFrictionScore) }}
              </dd>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <dt class="text-muted-foreground">Policy Constraint</dt>
              <dd class="m-0 font-medium text-foreground/70">
                {{ formatMetric(row.policyConstraintScore) }}
              </dd>
            </div>
          </dl>

          <!-- Detail sections — flat, no card wrappers -->
          <dl class="grid gap-6 text-xs lg:grid-cols-3">
            <div>
              <dt class="uppercase tracking-wide text-muted-foreground">Demand</dt>
              <dd class="mt-1 space-y-1 text-foreground/70">
                <div>0-24m expected MW: {{ formatMetric(row.expectedMw0To24m) }}</div>
                <div>24-60m expected MW: {{ formatMetric(row.expectedMw24To60m) }}</div>
                <div>Momentum QoQ: {{ formatMetric(row.demandMomentumQoq, 2) }}</div>
                <div>Provider entries 12m: {{ formatCount(row.providerEntryCount12m) }}</div>
              </dd>
            </div>

            <div>
              <dt class="uppercase tracking-wide text-muted-foreground">Supply + Friction</dt>
              <dd class="mt-1 space-y-1 text-foreground/70">
                <div>0-36m expected supply MW: {{ formatMetric(row.expectedSupplyMw0To36m) }}</div>
                <div>Signed IA MW: {{ formatMetric(row.signedIaMw) }}</div>
                <div>Queue MW active: {{ formatMetric(row.queueMwActive) }}</div>
                <div>Median queue days: {{ formatMetric(row.medianDaysInQueueActive, 0) }}</div>
                <div>Past-due share: {{ formatShare(row.pastDueShare) }}</div>
              </dd>
            </div>

            <div>
              <dt class="uppercase tracking-wide text-muted-foreground">Policy + Context</dt>
              <dd class="mt-1 space-y-1 text-foreground/70">
                <div>Moratorium: {{ row.moratoriumStatus }}</div>
                <div>Policy momentum: {{ formatMetric(row.policyMomentumScore) }}</div>
                <div>Policy events: {{ formatCount(row.policyEventCount) }}</div>
                <div>Primary market: {{ row.primaryMarketId ?? "-" }}</div>
              </dd>
            </div>
          </dl>

          <!-- Drivers, Deferred, Changes -->
          <div
            v-if="row.topDrivers.length > 0 || row.deferredReasonCodes.length > 0 || visibleChanges(row).length > 0"
            class="grid gap-6 text-xs lg:grid-cols-3"
          >
            <div>
              <div class="uppercase tracking-wide text-muted-foreground">Top Drivers</div>
              <ul class="mt-1 mb-0 space-y-1 pl-4 text-foreground/70">
                <li v-for="driver in row.topDrivers" :key="driver.code">
                  {{ driver.label }}: {{ driver.summary }}
                </li>
              </ul>
            </div>

            <div>
              <div class="uppercase tracking-wide text-muted-foreground">Deferred Reasons</div>
              <p v-if="row.deferredReasonCodes.length === 0" class="mt-1 mb-0 text-foreground/70">
                No deferred reasons.
              </p>
              <ul v-else class="mt-1 mb-0 space-y-1 pl-4 text-foreground/70">
                <li v-for="reason in row.deferredReasonCodes" :key="reason">
                  {{ formatDeferredReason(reason) }}
                </li>
              </ul>
            </div>

            <div>
              <div class="uppercase tracking-wide text-muted-foreground">What Changed</div>
              <p v-if="visibleChanges(row).length === 0" class="mt-1 mb-0 text-foreground/70">
                No tracked change yet.
              </p>
              <ul v-else class="mt-1 mb-0 space-y-1 pl-4 text-foreground/70">
                <li
                  v-for="change in visibleChanges(row)"
                  :key="`${change.code}-${change.direction}`"
                >
                  {{ change.label }}: {{ change.summary }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <p
        v-if="hasMissingCountyIds"
        class="rounded-sm border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
      >
        Counties not found in the reference geography: {{ missingCountyIds.join(", ") }}
      </p>
    </div>

    <p v-else class="text-xs text-muted-foreground">
      No county market-pressure rows are available for this selection.
    </p>
  </article>
</template>
