<script setup lang="ts">
  import type { CountyScoresDebugCounty } from "@map-migration/http-contracts/county-intelligence-debug-http";
  import type {
    SpatialAnalysisCountyScores,
    SpatialAnalysisCountyScoresStatus,
  } from "@map-migration/http-contracts/spatial-analysis-summary-http";
  import { computed } from "vue";
  import CountyScoresDatasetStatus from "@/features/county-intelligence/components/county-intelligence-dataset-status.vue";
  import {
    confidenceToneClass,
    countyLabel,
    formatCount,
    formatDateTime,
    formatDeferredReason,
    formatMetric,
    formatPillarValueState,
    formatRankStatus,
    formatShare,
    formatSourceVolatility,
    formatSuppressionState,
    formatTier,
    rankToneClass,
    suppressionToneClass,
  } from "@/features/county-intelligence/county-intelligence-display.service";
  import { useCountyScoresDiagnostics } from "@/features/county-intelligence/use-county-intelligence-diagnostics";
  import CountyPowerContextPanel from "@/features/spatial-analysis/components/county-power-context-panel.vue";

  interface SpatialAnalysisCountyScoresSectionProps {
    readonly countyScores: SpatialAnalysisCountyScores | null;
    readonly countyScoresStatus: SpatialAnalysisCountyScoresStatus | null;
    readonly errorMessage?: string | null;
    readonly isLoading?: boolean;
    readonly isStatusLoading?: boolean;
    readonly statusErrorMessage?: string | null;
  }

  const props = defineProps<SpatialAnalysisCountyScoresSectionProps>();

  type CountyScoreRow = SpatialAnalysisCountyScores["rows"][number];
  interface CountyChangeWindow {
    readonly changes: CountyScoreRow["whatChanged30d"];
    readonly key: "30d" | "60d" | "90d";
    readonly label: string;
  }

  const rows = computed(() => props.countyScores?.rows ?? []);
  const suppressedRows = computed(() =>
    rows.value.filter((row) => row.confidence.suppressionState === "suppressed")
  );
  const visibleRows = computed(() =>
    rows.value.filter((row) => row.confidence.suppressionState !== "suppressed")
  );
  const requestedCountyIds = computed(() => props.countyScores?.summary.requestedCountyIds ?? []);
  const missingCountyIds = computed(() => props.countyScores?.summary.missingCountyIds ?? []);
  const deferredCountyIds = computed(() => props.countyScores?.summary.deferredCountyIds ?? []);
  const blockedCountyIds = computed(() => props.countyScores?.summary.blockedCountyIds ?? []);
  const hasRows = computed(() => visibleRows.value.length > 0);
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
    () => visibleRows.value.filter((row) => row.rankStatus === "ranked").length
  );
  const diagnosticsEnabled = computed(
    () =>
      hasCountySummary.value ||
      props.countyScoresStatus !== null ||
      (props.isStatusLoading ?? false)
  );
  const {
    countyScoresCoverage,
    countyScoresCoverageError,
    countyScoresCoverageLoading,
    countyScoresResolution,
    countyScoresResolutionError,
    countyScoresResolutionLoading,
    countyScoresDebug,
    countyScoresDebugError,
  } = useCountyScoresDiagnostics({
    countyIds: requestedCountyIds,
    enabled: diagnosticsEnabled,
  });
  const debugByCountyFips = computed(
    () =>
      new Map(
        (countyScoresDebug.value?.counties ?? []).map(
          (county) => [county.countyFips, county] as const
        )
      )
  );

  function changeWindows(row: CountyScoreRow): readonly CountyChangeWindow[] {
    const windows: readonly CountyChangeWindow[] = [
      {
        key: "30d",
        label: "Last 30 days",
        changes: row.whatChanged30d,
      },
      {
        key: "60d",
        label: "Last 60 days",
        changes: row.whatChanged60d,
      },
      {
        key: "90d",
        label: "Last 90 days",
        changes: row.whatChanged90d,
      },
    ];

    return windows.filter((window) => window.changes.length > 0);
  }

  function debugCountyForRow(row: CountyScoreRow): CountyScoresDebugCounty | null {
    return debugByCountyFips.value.get(row.countyFips) ?? null;
  }

  function sampleEntries<T>(entries: readonly T[], limit = 3): readonly T[] {
    return entries.slice(0, limit);
  }

  function sampleOperatorZones(row: CountyScoreRow) {
    const debugCounty = debugCountyForRow(row);
    return debugCounty === null ? [] : sampleEntries(debugCounty.operatorZones);
  }

  function sampleQueueResolutions(row: CountyScoreRow) {
    const debugCounty = debugCountyForRow(row);
    return debugCounty === null ? [] : sampleEntries(debugCounty.queueResolutions);
  }

  function sampleQueuePoiReferences(row: CountyScoreRow) {
    const debugCounty = debugCountyForRow(row);
    return debugCounty === null ? [] : sampleEntries(debugCounty.queuePoiReferences);
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
      :coverage="countyScoresCoverage"
      :coverage-error-message="countyScoresCoverageError ?? null"
      :coverage-loading="countyScoresCoverageLoading"
      :resolution="countyScoresResolution"
      :resolution-error-message="countyScoresResolutionError ?? null"
      :resolution-loading="countyScoresResolutionLoading"
      :status="props.countyScoresStatus"
      :error-message="props.statusErrorMessage ?? null"
      :is-loading="props.isStatusLoading ?? false"
    />

    <p
      v-if="countyScoresDebugError"
      class="rounded-sm border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
    >
      {{ countyScoresDebugError }}
    </p>

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

      <div v-if="hasRows" class="space-y-6">
        <p
          v-if="suppressedRows.length > 0"
          class="rounded-sm border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
        >
          {{ suppressedRows.length }}
          county outputs are hidden because their suppression state is
          <span class="font-medium text-foreground/70">suppressed</span>.
        </p>

        <div
          v-for="row in visibleRows"
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
              <span
                v-if="row.confidence.suppressionState !== 'none'"
                class="rounded-sm border px-2.5 py-1 font-medium"
                :class="suppressionToneClass(row.confidence.suppressionState)"
              >
                {{ formatSuppressionState(row.confidence.suppressionState) }}
              </span>
            </div>
          </div>

          <div class="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
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
              <div class="uppercase tracking-wide text-muted-foreground">Source Volatility</div>
              <div class="text-sm font-semibold text-foreground/70">
                {{ formatSourceVolatility(row.sourceVolatility) }}
              </div>
            </div>
            <div class="rounded-sm bg-background px-2 py-1.5">
              <div class="uppercase tracking-wide text-muted-foreground">Updated</div>
              <div class="text-sm font-semibold text-foreground/70">
                {{ formatDateTime(row.lastUpdatedAt) }}
              </div>
            </div>
          </div>

          <div class="text-xs">
            <div class="uppercase tracking-wide text-muted-foreground">Narrative</div>
            <p class="mt-1 mb-0 text-foreground/70">
              {{ row.narrativeSummary ?? "No county narrative is available." }}
            </p>
          </div>

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
              <dt class="uppercase tracking-wide text-muted-foreground">Policy + Sentiment</dt>
              <dd class="mt-1 space-y-1 text-foreground/70">
                <div>Moratorium: {{ formatDeferredReason(row.moratoriumStatus) }}</div>
                <div>Policy momentum: {{ formatMetric(row.policyMomentumScore) }}</div>
                <div>Public sentiment: {{ formatMetric(row.publicSentimentScore, 2) }}</div>
                <div>Policy events: {{ formatCount(row.policyEventCount) }}</div>
                <div>County-tagged share: {{ formatShare(row.countyTaggedEventShare) }}</div>
                <div>
                  Policy mapping confidence:
                  {{ row.policyMappingConfidence === null ? "-" : row.policyMappingConfidence.toUpperCase() }}
                </div>
              </dd>
            </div>
          </dl>

          <div class="text-xs">
            <div class="uppercase tracking-wide text-muted-foreground">Pillar States</div>
            <dl class="mt-1 grid gap-6 text-foreground/70 sm:grid-cols-2 xl:grid-cols-5">
              <div class="rounded-sm bg-background px-2 py-1.5">
                <dt class="text-muted-foreground">Demand</dt>
                <dd class="m-0 font-medium">
                  {{ formatPillarValueState(row.pillarValueStates.demand) }}
                </dd>
              </div>
              <div class="rounded-sm bg-background px-2 py-1.5">
                <dt class="text-muted-foreground">Supply timeline</dt>
                <dd class="m-0 font-medium">
                  {{ formatPillarValueState(row.pillarValueStates.supplyTimeline) }}
                </dd>
              </div>
              <div class="rounded-sm bg-background px-2 py-1.5">
                <dt class="text-muted-foreground">Grid friction</dt>
                <dd class="m-0 font-medium">
                  {{ formatPillarValueState(row.pillarValueStates.gridFriction) }}
                </dd>
              </div>
              <div class="rounded-sm bg-background px-2 py-1.5">
                <dt class="text-muted-foreground">Policy</dt>
                <dd class="m-0 font-medium">
                  {{ formatPillarValueState(row.pillarValueStates.policy) }}
                </dd>
              </div>
              <div class="rounded-sm bg-background px-2 py-1.5">
                <dt class="text-muted-foreground">Infrastructure</dt>
                <dd class="m-0 font-medium">
                  {{ formatPillarValueState(row.pillarValueStates.infrastructure) }}
                </dd>
              </div>
            </dl>
          </div>

          <CountyPowerContextPanel :row="row" />

          <div v-if="debugCountyForRow(row) !== null" class="text-xs">
            <div class="uppercase tracking-wide text-muted-foreground">Debug Trail</div>
            <div class="mt-1 grid gap-3 lg:grid-cols-4">
              <div class="rounded-sm bg-background px-2 py-1.5 text-foreground/70">
                <div class="font-medium">Operator zones</div>
                <div>{{ formatCount(debugCountyForRow(row)?.operatorZones.length ?? null) }}</div>
                <ul
                  v-if="(debugCountyForRow(row)?.operatorZones.length ?? 0) > 0"
                  class="mt-1 mb-0 space-y-1 pl-4"
                >
                  <li
                    v-for="zone in sampleOperatorZones(row)"
                    :key="`${zone.wholesaleOperator}-${zone.operatorZoneLabel}-${zone.resolutionMethod}`"
                  >
                    {{ zone.operatorZoneLabel }}
                    · {{ zone.operatorZoneType }} ·
                    {{ zone.resolutionMethod }}
                  </li>
                </ul>
              </div>

              <div class="rounded-sm bg-background px-2 py-1.5 text-foreground/70">
                <div class="font-medium">Queue resolutions</div>
                <div>
                  {{ formatCount(debugCountyForRow(row)?.queueResolutions.length ?? null) }}
                </div>
                <ul
                  v-if="(debugCountyForRow(row)?.queueResolutions.length ?? 0) > 0"
                  class="mt-1 mb-0 space-y-1 pl-4"
                >
                  <li
                    v-for="resolution in sampleQueueResolutions(row)"
                    :key="`${resolution.sourceSystem}-${resolution.projectId}`"
                  >
                    {{ resolution.sourceSystem }}
                    · {{ resolution.resolverType }} ·
                    {{ resolution.projectId }}
                  </li>
                </ul>
              </div>

              <div class="rounded-sm bg-background px-2 py-1.5 text-foreground/70">
                <div class="font-medium">Queue POI references</div>
                <div>
                  {{ formatCount(debugCountyForRow(row)?.queuePoiReferences.length ?? null) }}
                </div>
                <ul
                  v-if="(debugCountyForRow(row)?.queuePoiReferences.length ?? 0) > 0"
                  class="mt-1 mb-0 space-y-1 pl-4"
                >
                  <li
                    v-for="reference in sampleQueuePoiReferences(row)"
                    :key="`${reference.sourceSystem}-${reference.queuePoiLabel}`"
                  >
                    {{ reference.sourceSystem }}
                    · {{ reference.queuePoiLabel }}
                  </li>
                </ul>
              </div>

              <div class="rounded-sm bg-background px-2 py-1.5 text-foreground/70">
                <div class="font-medium">Congestion snapshot</div>
                <div>
                  As of:
                  {{ formatDateTime(debugCountyForRow(row)?.congestionSnapshot?.sourceAsOfDate ?? null) }}
                </div>
                <div>
                  Avg RT:
                  {{ formatMetric(debugCountyForRow(row)?.congestionSnapshot?.avgRtCongestionComponent ?? null, 2) }}
                </div>
                <div>
                  P95 shadow:
                  {{ formatMetric(debugCountyForRow(row)?.congestionSnapshot?.p95ShadowPrice ?? null, 2) }}
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="row.topDrivers.length > 0 || row.deferredReasonCodes.length > 0"
            class="grid gap-6 text-xs lg:grid-cols-2"
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
          </div>

          <div class="text-xs">
            <div class="uppercase tracking-wide text-muted-foreground">Change Windows</div>
            <p v-if="changeWindows(row).length === 0" class="mt-1 mb-0 text-foreground/70">
              No tracked change yet.
            </p>
            <div v-else class="mt-1 grid gap-3 lg:grid-cols-3">
              <div
                v-for="window in changeWindows(row)"
                :key="window.key"
                class="rounded-sm bg-background px-2 py-1.5"
              >
                <div class="font-medium text-foreground/70">{{ window.label }}</div>
                <ul class="mt-1 mb-0 space-y-1 pl-4 text-foreground/70">
                  <li
                    v-for="change in window.changes"
                    :key="`${window.key}-${change.code}-${change.direction}`"
                  >
                    <span class="font-medium">{{ change.label }}</span>: {{ change.summary }}
                  </li>
                </ul>
              </div>
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
