<script setup lang="ts">
  import { Download, LayoutDashboard, X } from "lucide-vue-next";
  import { computed, shallowRef, watch } from "vue";
  import Button from "@/components/ui/button/button.vue";
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

    return props.expandedWidthClass ?? "w-[min(88rem,calc(100%-1.5rem))]";
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
        label: "Colocation",
        toneClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-800",
        value: panelSummary.value.colocation.count,
        visible: true,
      },
      {
        label: "Hyperscale",
        toneClass: "border-amber-500/20 bg-amber-500/10 text-amber-800",
        value: panelSummary.value.hyperscale.count,
        visible: true,
      },
      {
        label: "Markets",
        toneClass: "border-violet-500/20 bg-violet-500/10 text-violet-800",
        value: panelSummary.value.marketSelection?.matchCount ?? 0,
        visible: true,
      },
      {
        label: "Parcels",
        toneClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800",
        value: panelSummary.value.parcelSelection.count,
        visible: true,
      },
      {
        label: "Counties",
        toneClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-800",
        value: countyScores.value?.summary.requestedCountyIds.length ?? countySelectionCount.value,
        visible: hasCountyScores.value,
      },
    ].filter((chip) => chip.visible)
  );
  const visibleProgressStages = computed(() =>
    (props.progress?.stages ?? []).filter((stage) => stage.status !== "skipped")
  );
  const progressPercentText = computed(() => `${props.progress?.percent ?? 0}%`);
  const progressBarStyle = computed(() => ({
    width: `${props.progress?.percent ?? 0}%`,
  }));
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
      return "map-glass-button-active text-foreground";
    }

    if (tab.disabled) {
      return "map-glass-button cursor-not-allowed text-muted-foreground/60 opacity-60";
    }

    return "map-glass-button text-muted-foreground hover:text-foreground";
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
    class="map-glass-panel pointer-events-auto absolute bottom-4 right-3 z-20 flex max-h-[78vh] flex-col overflow-hidden rounded-xl p-3 transition-[width] duration-200"
    :class="panelWidthClass"
    :aria-label="props.title"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-base font-semibold">{{ props.title }}</h2>
          <span
            v-if="props.isLoading || props.isParcelsLoading"
            class="map-glass-pill inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {{ props.progress === null ? "Refreshing" : `Refreshing · ${progressPercentText}` }}
          </span>
        </div>
        <p class="m-0 text-[11px] text-muted-foreground">{{ props.subtitle }}</p>
      </div>

      <button
        type="button"
        :aria-label="props.dismissLabel"
        class="map-glass-button rounded p-1 text-muted-foreground transition hover:text-foreground"
        @click="emit('dismiss')"
      >
        <X class="h-4 w-4" />
      </button>
    </header>

    <p
      v-if="props.errorMessage !== null"
      class="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-900"
    >
      {{ props.errorMessage }}
    </p>

    <div v-if="hasAnyResults" class="mb-3 flex flex-wrap items-center gap-1.5">
      <span
        v-for="chip in summaryChips"
        :key="chip.label"
        class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        :class="chip.toneClass"
      >
        {{ chip.label }}
        · {{ chip.value }}
      </span>
    </div>

    <div v-if="hasAnyResults" class="map-glass-segment mb-3 inline-flex rounded-lg p-1">
      <button
        v-for="tab in tabItems"
        :key="tab.id"
        type="button"
        class="rounded-md px-2.5 py-1 text-xs font-medium transition"
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
      class="map-glass-card flex-1 overflow-auto rounded-lg p-3"
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
          <div class="flex items-center justify-between gap-3 text-[11px] font-medium">
            <span>Selection analysis</span>
            <span>{{ progressPercentText }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted/80">
            <div
              class="h-full rounded-full bg-cyan-500 transition-[width] duration-300"
              :style="progressBarStyle"
            />
          </div>
          <p class="m-0 text-[10px] text-muted-foreground">{{ progressStatusText }}</p>
        </div>

        <div class="space-y-2">
          <div
            v-for="stage in visibleProgressStages"
            :key="stage.key"
            class="map-glass-card rounded-md px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-2 w-2 rounded-full"
                  :class="progressStageDotClass(stage.status)"
                />
                <span class="text-[11px] font-medium">{{ stage.label }}</span>
              </div>
              <span class="text-[10px] uppercase tracking-wide text-muted-foreground">
                {{ progressStageStatusLabel(stage.status) }}
              </span>
            </div>
            <p class="mt-1 mb-0 text-[10px] text-muted-foreground">
              {{ stage.detail ?? "Waiting to start…" }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="animate-pulse space-y-2" role="status" aria-live="polite" aria-busy="true">
        <div class="h-3 w-40 rounded bg-muted" />
        <div class="h-3 w-56 rounded bg-muted" />
        <div class="h-3 w-48 rounded bg-muted" />
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
            class="map-glass-card rounded-md p-2 lg:col-span-2"
            aria-label="Market summary"
          >
            <div class="mb-1 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full bg-violet-500" />
              <h3 class="m-0 text-xs font-semibold text-violet-700">Market Coverage</h3>
            </div>

            <p
              v-if="marketSelectionUnavailableReason !== null"
              class="mb-2 rounded border border-violet-500/20 bg-violet-500/10 px-2 py-1.5 text-[11px] text-violet-900"
            >
              {{ marketSelectionUnavailableReason }}
            </p>

            <dl
              v-if="hasMarkets"
              class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px] sm:grid-cols-[repeat(3,minmax(0,1fr))]"
            >
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">Matches</dt>
                <dd class="m-0 font-medium">{{ panelSummary.marketSelection?.matchCount ?? 0 }}</dd>
              </div>
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">Primary</dt>
                <dd class="m-0 font-medium">
                  {{ panelSummary.marketSelection?.primaryMarket?.name ?? "-" }}
                </dd>
              </div>
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">Selection Area</dt>
                <dd class="m-0 font-medium">
                  {{ panelSummary.marketSelection?.selectionAreaSqKm.toFixed(1) ?? "0.0" }}
                  sq km
                </dd>
              </div>
            </dl>

            <div v-if="hasMarkets" class="mt-2 space-y-1">
              <div
                v-for="market in matchedMarkets"
                :key="market.marketId"
                class="map-glass-card rounded px-2 py-1.5 text-[11px]"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{{ market.name }}</span>
                  <span class="text-muted-foreground">
                    {{ formatOverlapPercent(market.marketOverlapPercent) }}
                  </span>
                </div>
                <div class="truncate text-[10px] text-muted-foreground">
                  {{ [market.region, market.state, market.country].filter(Boolean).join(" · ") || "No market metadata" }}
                </div>
                <div
                  class="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
                >
                  <span>Market covered</span>
                  <span>{{ formatOverlapPercent(market.marketOverlapPercent) }}</span>
                </div>
                <div
                  class="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
                >
                  <span>Selection share</span>
                  <span>{{ formatOverlapPercent(market.selectionOverlapPercent) }}</span>
                </div>
              </div>
            </div>
          </article>

          <article
            v-if="hasParcels || props.isParcelsLoading"
            class="map-glass-card rounded-md p-2 lg:col-span-2"
            aria-label="Parcel summary"
          >
            <div class="mb-1 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <h3 class="m-0 text-xs font-semibold text-emerald-700">Parcel Coverage</h3>
            </div>

            <dl
              class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px] sm:grid-cols-[repeat(3,minmax(0,1fr))]"
            >
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">Records</dt>
                <dd class="m-0 font-medium">{{ panelSummary.parcelSelection.count }}</dd>
              </div>
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">States</dt>
                <dd class="m-0 font-medium">{{ parcelOverview.stateCount }}</dd>
              </div>
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">Counties</dt>
                <dd class="m-0 font-medium">{{ parcelOverview.countyCount }}</dd>
              </div>
              <div class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1">
                <dt class="text-muted-foreground">Truncated</dt>
                <dd class="m-0 font-medium">
                  {{ panelSummary.parcelSelection.truncated ? "Yes" : "No" }}
                </dd>
              </div>
              <div
                class="map-glass-card flex items-center justify-between gap-2 rounded px-2 py-1 sm:col-span-2"
              >
                <dt class="text-muted-foreground">Next Cursor</dt>
                <dd class="m-0 max-w-[18rem] truncate font-mono text-[10px]">
                  {{ panelSummary.parcelSelection.nextCursor ?? "-" }}
                </dd>
              </div>
            </dl>

            <p v-if="props.isParcelsLoading" class="mt-2 text-[10px] text-muted-foreground">
              Refreshing parcels…
            </p>
          </article>
        </div>
      </div>
    </section>

    <section
      v-else-if="hasCountyScores && activeTab === 'counties'"
      class="map-glass-card flex-1 overflow-auto rounded-lg p-2"
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
      class="map-glass-card flex-1 overflow-auto rounded-lg"
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
      class="map-glass-card flex-1 overflow-auto rounded-lg"
    >
      <SpatialAnalysisParcelTable :parcels="orderedParcels" />
    </section>

    <section
      v-else
      class="map-glass-card flex-1 rounded-lg border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground"
    >
      {{ props.emptyMessage }}
    </section>

    <footer class="mt-3 flex items-center gap-2">
      <Button
        size="sm"
        variant="glass-active"
        class="flex-1"
        :disabled="props.dashboardDisabled"
        @click="emit('open-dashboard')"
      >
        <LayoutDashboard class="mr-1.5 h-3.5 w-3.5" />
        {{ props.dashboardLabel }}
      </Button>
      <Button size="sm" variant="glass" :disabled="props.exportDisabled" @click="emit('export')">
        <Download class="mr-1.5 h-3.5 w-3.5" />
        {{ props.exportLabel }}
      </Button>
      <Button size="sm" variant="glass" @click="emit('dismiss')">{{ props.dismissLabel }}</Button>
    </footer>
  </aside>
</template>
