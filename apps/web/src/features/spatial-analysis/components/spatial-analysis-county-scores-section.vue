<script setup lang="ts">
  import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/contracts";
  import { computed } from "vue";
  import CountyScoresDatasetStatus from "@/features/county-scores/components/county-scores-dataset-status.vue";
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
  } from "@/features/county-scores/county-scores-display.service";

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
  <article
    class="space-y-3 rounded-[4px] border border-[#E2E8F0] bg-white p-3 text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
  >
    <div class="flex items-center gap-2">
      <span class="inline-block h-2 w-2 rounded-full bg-[#0EA5E9]" />
      <div>
        <h2 class="m-0 text-[10px] font-semibold text-[#64748B]">County Market Pressure</h2>
        <p class="m-0 text-[10px] text-[#94A3B8]">
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
      class="rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[10px] text-[#B91C1C]"
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
      <div class="h-3 w-40 animate-pulse rounded bg-[#F1F5F9]" />
      <div class="h-28 animate-pulse rounded-[4px] bg-[#F1F5F9]" />
      <div class="h-28 animate-pulse rounded-[4px] bg-[#F1F5F9]" />
    </div>

    <div v-else-if="hasCountySummary" class="space-y-3">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Selected Counties</div>
          <div class="text-lg font-semibold text-[#64748B]">{{ requestedCountyIds.length }}</div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Ranked</div>
          <div class="text-lg font-semibold text-[#64748B]">{{ rankedCountyCount }}</div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Deferred</div>
          <div class="text-lg font-semibold text-[#64748B]">{{ deferredCountyIds.length }}</div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Blocked</div>
          <div class="text-lg font-semibold text-[#64748B]">{{ blockedCountyIds.length }}</div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Missing Geography</div>
          <div class="text-lg font-semibold text-[#64748B]">{{ missingCountyIds.length }}</div>
        </div>
      </div>

      <div v-if="hasRows" class="space-y-3">
        <div
          v-for="row in rows"
          :key="row.countyFips"
          class="space-y-3 rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1]"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-[#64748B]">{{ countyLabel(row) }}</div>
              <div class="text-[10px] text-[#94A3B8]">FIPS {{ row.countyFips }}</div>
            </div>

            <div class="flex flex-wrap items-center gap-2 text-[10px]">
              <span
                class="rounded-[4px] border px-2.5 py-1 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                :class="rankToneClass(row.rankStatus)"
              >
                {{ formatRankStatus(row.rankStatus) }}
              </span>
              <span
                class="rounded-[4px] border px-2.5 py-1 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                :class="confidenceToneClass(row.confidenceBadge)"
              >
                {{ row.confidenceBadge.toUpperCase() }}
                confidence
              </span>
            </div>
          </div>

          <div class="grid gap-2 lg:grid-cols-[1.3fr_1fr]">
            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
                <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Pressure Index</div>
                <div class="text-sm font-semibold text-[#64748B]">
                  {{ formatMetric(row.marketPressureIndex) }}
                </div>
              </div>
              <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
                <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Tier</div>
                <div class="text-sm font-semibold text-[#64748B]">
                  {{ formatTier(row.attractivenessTier) }}
                </div>
              </div>
              <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
                <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Freshness</div>
                <div class="text-sm font-semibold text-[#64748B]">
                  {{ formatMetric(row.freshnessScore) }}
                </div>
              </div>
              <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
                <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Updated</div>
                <div class="text-sm font-semibold text-[#64748B]">
                  {{ formatDateTime(row.lastUpdatedAt) }}
                </div>
              </div>
            </div>

            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 text-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
            >
              <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Narrative</div>
              <p class="mt-1 mb-0 text-[#64748B]">
                {{ row.narrativeSummary ?? "No county narrative is available." }}
              </p>
            </div>
          </div>

          <dl class="grid gap-2 text-[10px] sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
              <dt class="text-[#94A3B8]">Demand Pressure</dt>
              <dd class="m-0 font-medium text-[#64748B]">
                {{ formatMetric(row.demandPressureScore) }}
              </dd>
            </div>
            <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
              <dt class="text-[#94A3B8]">Supply Timeline</dt>
              <dd class="m-0 font-medium text-[#64748B]">
                {{ formatMetric(row.supplyTimelineScore) }}
              </dd>
            </div>
            <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
              <dt class="text-[#94A3B8]">Grid Friction</dt>
              <dd class="m-0 font-medium text-[#64748B]">
                {{ formatMetric(row.gridFrictionScore) }}
              </dd>
            </div>
            <div class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
              <dt class="text-[#94A3B8]">Policy Constraint</dt>
              <dd class="m-0 font-medium text-[#64748B]">
                {{ formatMetric(row.policyConstraintScore) }}
              </dd>
            </div>
          </dl>

          <dl class="grid gap-2 text-[10px] lg:grid-cols-3">
            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
            >
              <dt class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Demand</dt>
              <dd class="mt-1 space-y-1 text-[#64748B]">
                <div>0-24m expected MW: {{ formatMetric(row.expectedMw0To24m) }}</div>
                <div>24-60m expected MW: {{ formatMetric(row.expectedMw24To60m) }}</div>
                <div>Momentum QoQ: {{ formatMetric(row.demandMomentumQoq, 2) }}</div>
                <div>Provider entries 12m: {{ formatCount(row.providerEntryCount12m) }}</div>
              </dd>
            </div>

            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <dt class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Supply + Friction</dt>
              <dd class="mt-1 space-y-1 text-[#64748B]">
                <div>0-36m expected supply MW: {{ formatMetric(row.expectedSupplyMw0To36m) }}</div>
                <div>Signed IA MW: {{ formatMetric(row.signedIaMw) }}</div>
                <div>Queue MW active: {{ formatMetric(row.queueMwActive) }}</div>
                <div>Median queue days: {{ formatMetric(row.medianDaysInQueueActive, 0) }}</div>
                <div>Past-due share: {{ formatShare(row.pastDueShare) }}</div>
              </dd>
            </div>

            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <dt class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Policy + Context</dt>
              <dd class="mt-1 space-y-1 text-[#64748B]">
                <div>Moratorium: {{ row.moratoriumStatus }}</div>
                <div>Policy momentum: {{ formatMetric(row.policyMomentumScore) }}</div>
                <div>Policy events: {{ formatCount(row.policyEventCount) }}</div>
                <div>Primary market: {{ row.primaryMarketId ?? "-" }}</div>
              </dd>
            </div>
          </dl>

          <div
            v-if="row.topDrivers.length > 0 || row.deferredReasonCodes.length > 0 || visibleChanges(row).length > 0"
            class="grid gap-2 text-[10px] lg:grid-cols-3"
          >
            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Top Drivers</div>
              <ul class="mt-1 mb-0 space-y-1 pl-4 text-[#64748B]">
                <li v-for="driver in row.topDrivers" :key="driver.code">
                  {{ driver.label }}: {{ driver.summary }}
                </li>
              </ul>
            </div>

            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Deferred Reasons</div>
              <p v-if="row.deferredReasonCodes.length === 0" class="mt-1 mb-0 text-[#64748B]">
                No deferred reasons.
              </p>
              <ul v-else class="mt-1 mb-0 space-y-1 pl-4 text-[#64748B]">
                <li v-for="reason in row.deferredReasonCodes" :key="reason">
                  {{ formatDeferredReason(reason) }}
                </li>
              </ul>
            </div>

            <div
              class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">What Changed</div>
              <p v-if="visibleChanges(row).length === 0" class="mt-1 mb-0 text-[#64748B]">
                No tracked change yet.
              </p>
              <ul v-else class="mt-1 mb-0 space-y-1 pl-4 text-[#64748B]">
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
        class="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[10px] text-[#94A3B8]"
      >
        Counties not found in the reference geography: {{ missingCountyIds.join(", ") }}
      </p>
    </div>

    <p v-else class="text-[10px] text-[#94A3B8]">
      No county market-pressure rows are available for this selection.
    </p>
  </article>
</template>
