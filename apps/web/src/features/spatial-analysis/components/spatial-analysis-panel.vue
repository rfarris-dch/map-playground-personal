<script setup lang="ts">
  import { Download, LayoutDashboard, X } from "lucide-vue-next";
  import { computed, shallowRef, watch } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import SpatialAnalysisCountyScoresSection from "@/features/spatial-analysis/components/spatial-analysis-county-scores-section.vue";
  import SpatialAnalysisFacilitiesTable from "@/features/spatial-analysis/components/spatial-analysis-facilities-table.vue";
  import type {
    SpatialAnalysisPanelProps,
    SpatialAnalysisPanelSummary,
    SpatialAnalysisPanelTab,
  } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";
  import SpatialAnalysisParcelTable from "@/features/spatial-analysis/components/spatial-analysis-parcel-table.vue";
  import SpatialAnalysisPerspectiveCard from "@/features/spatial-analysis/components/spatial-analysis-perspective-card.vue";
  import SpatialAnalysisSummaryOverview from "@/features/spatial-analysis/components/spatial-analysis-summary-overview.vue";
  import { compareSpatialAnalysisFacilities } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
  import { summarizeSpatialAnalysisParcels } from "@/features/spatial-analysis/spatial-analysis-overview.service";

  const props = defineProps<SpatialAnalysisPanelProps>();

  const emit = defineEmits<{
    "open-dashboard": [];
    dismiss: [];
    export: [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const activeTab = shallowRef<SpatialAnalysisPanelTab>("overview");

  function createEmptySummary(): SpatialAnalysisPanelSummary {
    return {
      colocation: {
        availablePowerMw: 0,
        commissionedPowerMw: 0,
        count: 0,
        leasedCount: 0,
        operationalCount: 0,
        pipelinePowerMw: 0,
        plannedCount: 0,
        plannedPowerMw: 0,
        squareFootage: 0,
        underConstructionCount: 0,
        underConstructionPowerMw: 0,
        unknownCount: 0,
      },
      facilities: [],
      hyperscale: {
        availablePowerMw: 0,
        commissionedPowerMw: 0,
        count: 0,
        leasedCount: 0,
        operationalCount: 0,
        pipelinePowerMw: 0,
        plannedCount: 0,
        plannedPowerMw: 0,
        squareFootage: 0,
        underConstructionCount: 0,
        underConstructionPowerMw: 0,
        unknownCount: 0,
      },
      marketSelection: {
        markets: [],
        matchCount: 0,
        minimumSelectionOverlapPercent: 0,
        primaryMarket: null,
        selectionAreaSqKm: 0,
        unavailableReason: null,
      },
      parcelSelection: {
        count: 0,
        nextCursor: null,
        parcels: [],
        truncated: false,
      },
      topColocationProviders: [],
      topHyperscaleProviders: [],
      totalCount: 0,
    };
  }

  const panelSummary = computed(() => props.summary?.summary ?? createEmptySummary());

  const hasFacilities = computed(() => panelSummary.value.totalCount > 0);
  const hasMarkets = computed(() => (panelSummary.value.marketSelection?.matchCount ?? 0) > 0);
  const marketSelectionUnavailableReason = computed(
    () => panelSummary.value.marketSelection?.unavailableReason ?? null
  );
  const hasParcels = computed(() => panelSummary.value.parcelSelection.count > 0);
  const countySelectionCount = computed(() => props.summary?.area.countyIds.length ?? 0);
  const countyScores = computed(() => props.summary?.countyIntelligence.scores ?? null);
  const countyScoresError = computed(() => props.summary?.countyIntelligence.scoresError ?? null);
  const countyScoresStatus = computed(() => props.summary?.countyIntelligence.status ?? null);
  const countyScoresStatusError = computed(
    () => props.summary?.countyIntelligence.statusError ?? null
  );
  const hasCountyScores = computed(() => {
    if (
      countySelectionCount.value > 0 ||
      countyScoresError.value ||
      countyScoresStatusError.value
    ) {
      return true;
    }

    return (
      (countyScores.value?.summary.requestedCountyIds.length ?? 0) > 0 ||
      countyScoresStatus.value !== null
    );
  });
  const hasAnyResults = computed(
    () => hasFacilities.value || hasMarkets.value || hasParcels.value || hasCountyScores.value
  );
  const hasColocation = computed(() => panelSummary.value.colocation.count > 0);
  const hasHyperscale = computed(() => panelSummary.value.hyperscale.count > 0);

  const orderedFacilities = computed(() => {
    const facilities = [...panelSummary.value.facilities];
    facilities.sort(compareSpatialAnalysisFacilities);
    return facilities;
  });

  const orderedParcels = computed(() => panelSummary.value.parcelSelection.parcels);
  const matchedMarkets = computed(() => panelSummary.value.marketSelection?.markets ?? []);
  const panelWidthClass = computed(() => {
    if (activeTab.value === "overview") {
      return props.compactWidthClass ?? "w-[min(32rem,calc(100%-1.5rem))]";
    }

    return props.expandedWidthClass ?? "w-[min(52rem,calc(100%-1.5rem))]";
  });

  const parcelOverview = computed(() => summarizeSpatialAnalysisParcels(orderedParcels.value));

  const tabItems = computed<
    readonly {
      readonly count: number | null;
      readonly disabled: boolean;
      readonly id: SpatialAnalysisPanelTab;
      readonly label: string;
    }[]
  >(() => [
    {
      count: null,
      disabled: false,
      id: "overview",
      label: "Overview",
    },
    {
      count: countySelectionCount.value,
      disabled: !hasCountyScores.value,
      id: "counties",
      label: "Counties",
    },
    {
      count: panelSummary.value.totalCount,
      disabled: !hasFacilities.value,
      id: "facilities",
      label: "Facilities",
    },
    {
      count: panelSummary.value.parcelSelection.count,
      disabled: !hasParcels.value,
      id: "parcels",
      label: "Parcels",
    },
  ]);

  const summaryChips = computed(() =>
    [
      {
        dotClass: "bg-[#3B82F6]",
        label: "Colocation",
        value: panelSummary.value.colocation.count,
        visible: true,
      },
      {
        dotClass: "bg-[#F97316]",
        label: "Hyperscale",
        value: panelSummary.value.hyperscale.count,
        visible: true,
      },
      {
        dotClass: "bg-[#8B5CF6]",
        label: "Markets",
        value: panelSummary.value.marketSelection?.matchCount ?? 0,
        visible: true,
      },
      {
        dotClass: "bg-[#10B981]",
        label: "Parcels",
        value: panelSummary.value.parcelSelection.count,
        visible: true,
      },
      {
        dotClass: "bg-[#6366F1]",
        label: "Counties",
        value: countyScores.value?.summary.requestedCountyIds.length ?? countySelectionCount.value,
        visible: hasCountyScores.value,
      },
    ].filter((chip) => chip.visible)
  );
  const visibleProgressStages = computed(() =>
    (props.progress?.stages ?? []).filter((stage) => stage.status !== "skipped")
  );
  const progressPercentText = computed(() => `${props.progress?.percent ?? 0}%`);
  const progressStatusText = computed(() => {
    const progress = props.progress ?? null;
    if (progress === null) {
      return "Preparing analysis…";
    }

    return `${progress.completedStageCount} of ${progress.totalStageCount} stages finished`;
  });

  function formatOverlapPercent(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return "0%";
    }

    const percent = value * 100;
    if (percent < 0.1) {
      return "<0.1%";
    }

    if (percent < 10) {
      return `${percent.toFixed(1)}%`;
    }

    return `${Math.round(percent)}%`;
  }

  function tabClass(tab: {
    readonly disabled: boolean;
    readonly id: SpatialAnalysisPanelTab;
  }): string {
    if (activeTab.value === tab.id) {
      return "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08),0_1px_2px_rgba(15,23,42,0.04)]";
    }

    if (tab.disabled) {
      return "cursor-not-allowed border-[#E2E8F0] bg-white text-[#CBD5E1] opacity-60";
    }

    return "border-[#E2E8F0] bg-white text-[#94A3B8] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B] active:bg-[#F1F5F9]";
  }

  function progressStageDotClass(status: string): string {
    if (status === "complete") {
      return "bg-emerald-500";
    }

    if (status === "error") {
      return "bg-red-500";
    }

    if (status === "running") {
      return "bg-cyan-500";
    }

    return "bg-muted-foreground/50";
  }

  function progressStageStatusLabel(status: string): string {
    if (status === "complete") {
      return "Done";
    }

    if (status === "error") {
      return "Failed";
    }

    if (status === "running") {
      return "Running";
    }

    return "Pending";
  }

  watch(
    [hasAnyResults, hasParcels],
    ([nextHasAnyResults, nextHasParcels]) => {
      if (!nextHasAnyResults) {
        activeTab.value = "overview";
        return;
      }

      if (!nextHasParcels && activeTab.value === "parcels") {
        activeTab.value = "overview";
        return;
      }

      if (!hasCountyScores.value && activeTab.value === "counties") {
        activeTab.value = "overview";
      }
    },
    {
      immediate: true,
    }
  );
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex max-h-[78vh] flex-col overflow-hidden rounded-[4px] border border-[#E2E8F0] bg-white p-2 text-[#94A3B8] shadow-[0_4px_8px_rgba(0,0,0,0.06)] transition-[width] duration-200 [font-family:Inter,var(--font-sans)]"
    :class="panelWidthClass"
    :aria-label="props.title"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-[12px] font-semibold text-[#64748B]">{{ props.title }}</h2>
          <span
            v-if="props.isLoading || props.isParcelsLoading"
            class="inline-flex items-center rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-0.5 text-[10px] font-medium text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            {{ props.progress === null ? "Refreshing" : `Refreshing · ${progressPercentText}` }}
          </span>
        </div>
        <p class="m-0 text-[10px] text-[#94A3B8]">{{ props.subtitle }}</p>
      </div>

      <button
        type="button"
        :aria-label="props.dismissLabel"
        class="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-[#E2E8F0] bg-white text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
        @click="emit('dismiss')"
      >
        <X class="h-4 w-4" />
      </button>
    </header>

    <p
      v-if="props.errorMessage !== null"
      class="mb-3 rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[10px] text-[#B91C1C]"
    >
      {{ props.errorMessage }}
    </p>

    <div v-if="hasAnyResults" class="mb-3 flex flex-wrap items-center gap-1.5">
      <span
        v-for="chip in summaryChips"
        :key="chip.label"
        class="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-medium text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="chip.dotClass" />
        <span>{{ chip.label }}</span>
        <span class="text-[#64748B]">{{ chip.value }}</span>
      </span>
    </div>

    <div
      v-if="hasAnyResults"
      class="mb-3 inline-flex rounded-[4px] border border-[#E2E8F0] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <button
        v-for="tab in tabItems"
        :key="tab.id"
        type="button"
        class="rounded-[4px] border px-2.5 py-1 text-[10px] font-medium transition-colors"
        :class="tabClass(tab)"
        :disabled="tab.disabled"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.count !== null">({{ tab.count }})</span>
      </button>
    </div>

    <section
      v-if="props.isLoading"
      class="flex-1 overflow-auto rounded-[4px] border border-[#E2E8F0] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      :aria-label="`${props.title} loading`"
    >
      <div
        v-if="props.progress !== null"
        class="space-y-3"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="space-y-1.5">
          <div
            class="flex items-center justify-between gap-3 text-[10px] font-medium text-[#94A3B8]"
          >
            <span>Selection analysis</span>
            <span>{{ progressPercentText }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC]">
            <div class="h-full w-full animate-pulse rounded-full bg-[#CBD5E1]" />
          </div>
          <p class="m-0 text-[10px] text-[#94A3B8]">{{ progressStatusText }}</p>
        </div>

        <div class="space-y-2">
          <div
            v-for="stage in visibleProgressStages"
            :key="stage.key"
            class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-2 w-2 rounded-full"
                  :class="progressStageDotClass(stage.status)"
                />
                <span class="text-[10px] font-medium text-[#64748B]">{{ stage.label }}</span>
              </div>
              <span class="text-[10px] uppercase tracking-wide text-[#94A3B8]">
                {{ progressStageStatusLabel(stage.status) }}
              </span>
            </div>
            <p class="mt-1 mb-0 text-[10px] text-[#94A3B8]">
              {{ stage.detail ?? "Waiting to start…" }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="animate-pulse space-y-2" role="status" aria-live="polite" aria-busy="true">
        <div class="h-3 w-40 rounded bg-[#F1F5F9]" />
        <div class="h-3 w-56 rounded bg-[#F1F5F9]" />
        <div class="h-3 w-48 rounded bg-[#F1F5F9]" />
      </div>
    </section>

    <section v-else-if="hasAnyResults && activeTab === 'overview'" class="flex-1 overflow-auto">
      <div class="space-y-3">
        <SpatialAnalysisSummaryOverview
          :facilities="orderedFacilities"
          :parcels="orderedParcels"
          :summary="panelSummary"
          :format-power="props.formatPower"
          @select-facility="emit('select-facility', $event)"
        />

        <div class="grid gap-3 lg:grid-cols-2">
          <SpatialAnalysisPerspectiveCard
            v-if="hasColocation"
            title="Colocation"
            accent="colocation"
            :summary="panelSummary.colocation"
            :providers="panelSummary.topColocationProviders"
            :format-power="props.formatPower"
            :power-label="props.perspectivePowerLabel ?? 'Commissioned'"
          />

          <SpatialAnalysisPerspectiveCard
            v-if="hasHyperscale"
            title="Hyperscale"
            accent="hyperscale"
            :summary="panelSummary.hyperscale"
            :providers="panelSummary.topHyperscaleProviders"
            :format-power="props.formatPower"
            :power-label="props.perspectivePowerLabel ?? 'Commissioned'"
          />

          <article
            v-if="hasMarkets || marketSelectionUnavailableReason !== null"
            class="rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2"
            aria-label="Market summary"
          >
            <div class="mb-1 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full bg-[#8B5CF6]" />
              <h3 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Market Coverage</h3>
            </div>

            <p
              v-if="marketSelectionUnavailableReason !== null"
              class="mb-2 rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[10px] text-[#94A3B8]"
            >
              {{ marketSelectionUnavailableReason }}
            </p>

            <dl
              v-if="hasMarkets"
              class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px] sm:grid-cols-[repeat(3,minmax(0,1fr))]"
            >
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">Matches</dt>
                <dd class="m-0 font-medium text-[#64748B]">
                  {{ panelSummary.marketSelection?.matchCount ?? 0 }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">Primary</dt>
                <dd class="m-0 font-medium text-[#64748B]">
                  {{ panelSummary.marketSelection?.primaryMarket?.name ?? "-" }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">Selection Area</dt>
                <dd class="m-0 font-medium text-[#64748B]">
                  {{ panelSummary.marketSelection?.selectionAreaSqKm.toFixed(1) ?? "0.0" }}
                  sq km
                </dd>
              </div>
            </dl>

            <div v-if="hasMarkets" class="mt-2 space-y-1">
              <div
                v-for="market in matchedMarkets"
                :key="market.marketId"
                class="rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1.5 text-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium text-[#64748B]">{{ market.name }}</span>
                  <span class="text-[#94A3B8]">
                    {{ formatOverlapPercent(market.marketOverlapPercent) }}
                  </span>
                </div>
                <div class="truncate text-[10px] text-[#94A3B8]">
                  {{ [market.region, market.state, market.country].filter(Boolean).join(" · ") || "No market metadata" }}
                </div>
                <div
                  class="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#94A3B8]"
                >
                  <span>Market covered</span>
                  <span>{{ formatOverlapPercent(market.marketOverlapPercent) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2 text-[10px] text-[#94A3B8]">
                  <span>Selection share</span>
                  <span>{{ formatOverlapPercent(market.selectionOverlapPercent) }}</span>
                </div>
              </div>
            </div>
          </article>

          <article
            v-if="hasParcels || props.isParcelsLoading"
            class="rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2"
            aria-label="Parcel summary"
          >
            <div class="mb-1 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full bg-[#10B981]" />
              <h3 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Parcel Coverage</h3>
            </div>

            <dl
              class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px] sm:grid-cols-[repeat(3,minmax(0,1fr))]"
            >
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">Records</dt>
                <dd class="m-0 font-medium text-[#64748B]">
                  {{ panelSummary.parcelSelection.count }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">States</dt>
                <dd class="m-0 font-medium text-[#64748B]">{{ parcelOverview.stateCount }}</dd>
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">Counties</dt>
                <dd class="m-0 font-medium text-[#64748B]">{{ parcelOverview.countyCount }}</dd>
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <dt class="text-[#94A3B8]">Truncated</dt>
                <dd class="m-0 font-medium text-[#64748B]">
                  {{ panelSummary.parcelSelection.truncated ? "Yes" : "No" }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:col-span-2"
              >
                <dt class="text-[#94A3B8]">Next Cursor</dt>
                <dd class="m-0 max-w-[18rem] truncate text-[10px] text-[#64748B]">
                  {{ panelSummary.parcelSelection.nextCursor ?? "-" }}
                </dd>
              </div>
            </dl>

            <p v-if="props.isParcelsLoading" class="mt-2 text-[10px] text-[#94A3B8]">
              Refreshing parcels…
            </p>
          </article>
        </div>
      </div>
    </section>

    <section
      v-else-if="hasCountyScores && activeTab === 'counties'"
      class="flex-1 overflow-auto rounded-[4px] border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <SpatialAnalysisCountyScoresSection
        :county-scores="countyScores"
        :error-message="countyScoresError"
        :county-scores-status="countyScoresStatus"
        :status-error-message="countyScoresStatusError"
      />
    </section>

    <section
      v-else-if="hasFacilities && activeTab === 'facilities'"
      class="flex-1 overflow-auto rounded-[4px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <SpatialAnalysisFacilitiesTable
        :facilities="orderedFacilities"
        :format-power="props.formatFacilityPower"
        :lease-semantic="props.leaseSemantic ?? false"
        :perspective-display="props.facilitiesPerspectiveDisplay ?? 'badge'"
        :power-heading="props.facilitiesPowerHeading ?? 'Power'"
        :show-coordinates="props.showCoordinates ?? false"
        @select-facility="emit('select-facility', $event)"
      />
    </section>

    <section
      v-else-if="hasParcels && activeTab === 'parcels'"
      class="flex-1 overflow-auto rounded-[4px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <SpatialAnalysisParcelTable :parcels="orderedParcels" />
    </section>

    <section
      v-else
      class="flex-1 rounded-[4px] border border-dashed border-[#E2E8F0] bg-white px-3 py-6 text-center text-[10px] text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      {{ props.emptyMessage }}
    </section>

    <footer class="mt-3 flex items-center gap-2">
      <button
        type="button"
        class="inline-flex h-[22px] flex-1 items-center justify-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[10px] font-medium text-[#64748B] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="props.dashboardDisabled"
        @click="emit('open-dashboard')"
      >
        <LayoutDashboard class="h-3.5 w-3.5" />
        {{ props.dashboardLabel }}
      </button>
      <button
        type="button"
        class="inline-flex h-[22px] items-center justify-center gap-1.5 rounded-[4px] border border-[#E2E8F0] bg-white px-3 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="props.exportDisabled"
        @click="emit('export')"
      >
        <Download class="h-3.5 w-3.5" />
        {{ props.exportLabel }}
      </button>
      <button
        type="button"
        class="inline-flex h-[22px] items-center justify-center rounded-[4px] border border-[#E2E8F0] bg-white px-3 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
        @click="emit('dismiss')"
      >
        {{ props.dismissLabel }}
      </button>
    </footer>
  </aside>
</template>
