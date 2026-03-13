<script setup lang="ts">
  import { ArrowLeft, Clock3 } from "lucide-vue-next";
  import { computed, shallowRef } from "vue";
  import { useRouter } from "vue-router";
  import Button from "@/components/ui/button/button.vue";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import SpatialAnalysisCountyScoresSection from "@/features/spatial-analysis/components/spatial-analysis-county-scores-section.vue";
  import SpatialAnalysisFacilitiesTable from "@/features/spatial-analysis/components/spatial-analysis-facilities-table.vue";
  import SpatialAnalysisParcelTable from "@/features/spatial-analysis/components/spatial-analysis-parcel-table.vue";
  import SpatialAnalysisPerspectiveCard from "@/features/spatial-analysis/components/spatial-analysis-perspective-card.vue";
  import SpatialAnalysisSummaryOverview from "@/features/spatial-analysis/components/spatial-analysis-summary-overview.vue";
  import {
    clearSpatialAnalysisDashboardState,
    loadSpatialAnalysisDashboardState,
  } from "@/features/spatial-analysis/spatial-analysis-dashboard.service";
  import type { SpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.types";
  import { compareSpatialAnalysisFacilities } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
  import { summarizeSpatialAnalysisParcels } from "@/features/spatial-analysis/spatial-analysis-overview.service";

  type DashboardTab = "counties" | "facilities" | "overview" | "parcels";

  function createEmptyDashboardSummary() {
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

  const router = useRouter();
  const dashboardState = shallowRef<SpatialAnalysisDashboardState | null>(
    loadSpatialAnalysisDashboardState()
  );
  const activeTab = shallowRef<DashboardTab>("overview");
  const selectedCountyIds = computed(() => dashboardState.value?.summary.area.countyIds ?? []);
  const summary = computed(() => dashboardState.value?.summary.summary ?? null);
  const dashboardSummary = computed(() => summary.value ?? createEmptyDashboardSummary());
  const facilities = computed(() => {
    const summaryValue = summary.value;
    if (summaryValue === null) {
      return [];
    }

    const orderedFacilities = [...summaryValue.facilities];
    orderedFacilities.sort(compareSpatialAnalysisFacilities);
    return orderedFacilities;
  });
  const parcels = computed(() => summary.value?.parcelSelection.parcels ?? []);
  const parcelOverview = computed(() => summarizeSpatialAnalysisParcels(parcels.value));
  const hasFacilities = computed(() => facilities.value.length > 0);
  const hasParcels = computed(() => parcels.value.length > 0);
  const selectionMarketCount = computed(() => {
    const state = dashboardState.value;
    if (state === null || state.source !== "selection") {
      return 0;
    }

    return state.summary.summary.marketSelection?.matchCount ?? 0;
  });
  const hasMarkets = computed(() => selectionMarketCount.value > 0);
  const hasCountySelections = computed(() => selectedCountyIds.value.length > 0);
  const hasCountyTab = computed(() => hasCountySelections.value || stateHasCountyIntelligence());
  const hasAnyResults = computed(
    () => hasFacilities.value || hasParcels.value || hasMarkets.value || hasCountyTab.value
  );
  const isSelectionDashboard = computed(() => dashboardState.value?.source === "selection");
  const formatPower = computed(() =>
    isSelectionDashboard.value ? formatMeasurePowerMw : formatScannerPowerMw
  );
  const pageTitle = computed(() =>
    dashboardState.value?.source === "selection" ? "Selection Dashboard" : "Scanner Dashboard"
  );
  const pageSubtitle = computed(() => {
    const state = dashboardState.value;
    if (state === null) {
      return "No saved spatial analysis state is available.";
    }

    const summaryValue = state.summary.summary;
    const createdAtText = new Date(state.createdAt).toLocaleString();

    if (state.source === "selection") {
      return `${summaryValue.totalCount} facilities · ${summaryValue.marketSelection?.matchCount ?? 0} markets · ${summaryValue.parcelSelection.count} parcels · saved ${createdAtText}`;
    }

    return `${summaryValue.totalCount} facilities · ${summaryValue.parcelSelection.count} parcels · saved ${createdAtText}`;
  });

  function goBackToMap(): void {
    router.push({ name: "map" });
  }

  function clearSavedDashboard(): void {
    clearSpatialAnalysisDashboardState();
    dashboardState.value = null;
  }

  function stateHasCountyIntelligence(): boolean {
    const state = dashboardState.value;
    if (state === null) {
      return false;
    }

    return (
      state.summary.countyIntelligence.requestedCountyIds.length > 0 ||
      state.summary.countyIntelligence.scores !== null ||
      state.summary.countyIntelligence.status !== null ||
      state.summary.countyIntelligence.scoresError !== null ||
      state.summary.countyIntelligence.statusError !== null
    );
  }
</script>

<template>
  <main class="min-h-full bg-background">
    <div class="mx-auto flex w-full max-w-[1380px] flex-col gap-4 px-4 py-5">
      <header
        class="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur-sm lg:flex-row lg:items-start lg:justify-between"
      >
        <div class="space-y-2">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Clock3 class="h-3.5 w-3.5" />
            Spatial Analysis
          </div>
          <div>
            <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ pageTitle }}</h1>
            <p class="mt-1 text-sm text-muted-foreground">{{ pageSubtitle }}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" @click="goBackToMap">
            <ArrowLeft class="mr-1.5 h-4 w-4" />
            Back to Map
          </Button>
          <Button variant="ghost" @click="clearSavedDashboard">Clear Saved State</Button>
        </div>
      </header>

      <section
        v-if="dashboardState === null"
        class="rounded-2xl border border-dashed border-border/70 bg-card/70 px-6 py-12 text-center shadow-sm"
      >
        <h2 class="m-0 text-lg font-semibold">No saved analysis</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          Open scanner or selection analysis on the map, then use Open Dashboard.
        </p>
        <Button class="mt-4" @click="goBackToMap">Return to Map</Button>
      </section>

      <section v-else class="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <div
          v-if="hasAnyResults"
          class="mb-4 inline-flex rounded-xl border border-border/70 bg-background/80 p-1"
        >
          <Button
            size="sm"
            :variant="activeTab === 'overview' ? 'default' : 'ghost'"
            class="h-8 rounded-lg px-3"
            @click="activeTab = 'overview'"
          >
            Overview
          </Button>
          <Button
            size="sm"
            :variant="activeTab === 'counties' ? 'default' : 'ghost'"
            class="h-8 rounded-lg px-3"
            :disabled="!hasCountyTab"
            @click="activeTab = 'counties'"
          >
            Counties ({{ selectedCountyIds.length }})
          </Button>
          <Button
            size="sm"
            :variant="activeTab === 'facilities' ? 'default' : 'ghost'"
            class="h-8 rounded-lg px-3"
            :disabled="!hasFacilities"
            @click="activeTab = 'facilities'"
          >
            Facilities ({{ facilities.length }})
          </Button>
          <Button
            size="sm"
            :variant="activeTab === 'parcels' ? 'default' : 'ghost'"
            class="h-8 rounded-lg px-3"
            :disabled="!hasParcels"
            @click="activeTab = 'parcels'"
          >
            Parcels ({{ parcels.length }})
          </Button>
        </div>

        <div
          v-if="!hasAnyResults"
          class="rounded-xl border border-dashed border-border/70 bg-background/70 px-5 py-10 text-center text-sm text-muted-foreground"
        >
          No facilities or parcels are available in the saved analysis.
        </div>

        <section v-if="hasAnyResults && activeTab === 'overview'" class="space-y-4">
          <div class="grid gap-4 xl:grid-cols-2">
            <SpatialAnalysisPerspectiveCard
              title="Colocation"
              accent="colocation"
              :summary="dashboardSummary.colocation"
              :providers="dashboardSummary.topColocationProviders"
              :format-power="formatPower"
              power-label="Commissioned"
            />

            <SpatialAnalysisPerspectiveCard
              title="Hyperscale"
              accent="hyperscale"
              provider-heading="Top Users"
              :summary="dashboardSummary.hyperscale"
              :providers="dashboardSummary.topHyperscaleProviders"
              :format-power="formatPower"
              power-label="Commissioned"
            />
          </div>

          <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SpatialAnalysisSummaryOverview
              :facilities="facilities"
              :parcels="parcels"
              :summary="dashboardSummary"
              :format-power="formatPower"
            />

            <article class="rounded-xl border border-border/70 bg-background/70 p-4">
              <div class="mb-2 flex items-center gap-2">
                <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h2 class="m-0 text-sm font-semibold">Parcel Coverage</h2>
              </div>
              <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
                <dt class="text-muted-foreground">Selected Parcels</dt>
                <dd class="m-0 font-medium">{{ dashboardSummary.parcelSelection.count }}</dd>
                <dt class="text-muted-foreground">States</dt>
                <dd class="m-0">{{ parcelOverview.stateCount }}</dd>
                <dt class="text-muted-foreground">Counties</dt>
                <dd class="m-0">{{ parcelOverview.countyCount }}</dd>
                <dt class="text-muted-foreground">Truncated</dt>
                <dd class="m-0">{{ dashboardSummary.parcelSelection.truncated ? "Yes" : "No" }}</dd>
              </dl>
            </article>
          </div>
        </section>

        <section v-if="hasCountyTab && activeTab === 'counties'" class="space-y-4">
          <SpatialAnalysisCountyScoresSection
            :county-scores="dashboardState.summary.countyIntelligence.scores"
            :county-scores-status="dashboardState.summary.countyIntelligence.status"
            :error-message="dashboardState.summary.countyIntelligence.scoresError"
            :status-error-message="dashboardState.summary.countyIntelligence.statusError"
          />
        </section>

        <section
          v-if="hasFacilities && activeTab === 'facilities'"
          class="overflow-auto rounded-xl border border-border/70"
        >
          <SpatialAnalysisFacilitiesTable
            :facilities="facilities"
            :format-power="(powerMw) => formatPower(powerMw ?? 0)"
            :lease-semantic="!isSelectionDashboard"
            :perspective-display="isSelectionDashboard ? 'dot' : 'badge'"
            :show-coordinates="!isSelectionDashboard"
            :selectable="false"
          />
        </section>

        <section
          v-if="hasParcels && activeTab === 'parcels'"
          class="overflow-auto rounded-xl border border-border/70"
        >
          <SpatialAnalysisParcelTable :parcels="parcels" :rows-per-page="100" />
        </section>
      </section>
    </div>
  </main>
</template>
