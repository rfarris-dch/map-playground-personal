import { computed, shallowRef, watch } from "vue";
import type {
  SpatialAnalysisPanelProps,
  SpatialAnalysisPanelSummary,
  SpatialAnalysisPanelTab,
} from "@/features/spatial-analysis/components/spatial-analysis-panel.types";
import { compareSpatialAnalysisFacilities } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
import { summarizeSpatialAnalysisParcels } from "@/features/spatial-analysis/spatial-analysis-overview.service";

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

export function useSpatialAnalysisPanelState(props: SpatialAnalysisPanelProps) {
  const activeTab = shallowRef<SpatialAnalysisPanelTab>("overview");

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
        dotClass: "bg-colocation",
        label: "Colocation",
        value: panelSummary.value.colocation.count,
        visible: true,
      },
      {
        dotClass: "bg-orange-500",
        label: "Hyperscale",
        value: panelSummary.value.hyperscale.count,
        visible: true,
      },
      {
        dotClass: "bg-violet-500",
        label: "Markets",
        value: panelSummary.value.marketSelection?.matchCount ?? 0,
        visible: true,
      },
      {
        dotClass: "bg-hyperscale",
        label: "Parcels",
        value: panelSummary.value.parcelSelection.count,
        visible: true,
      },
      {
        dotClass: "bg-indigo-500",
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
      return "Preparing analysis\u2026";
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
      return "border-border bg-background text-foreground/70 ring-1 ring-border shadow-xs";
    }

    if (tab.disabled) {
      return "cursor-not-allowed border-border bg-card text-border opacity-60";
    }

    return "border-border bg-card text-muted-foreground hover:border-border hover:bg-background hover:text-foreground/70 active:bg-muted";
  }

  function progressStageDotClass(status: string): string {
    if (status === "complete") {
      return "bg-emerald-500";
    }

    if (status === "error") {
      return "bg-[var(--error)]";
    }

    if (status === "running") {
      return "bg-info";
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

  function firstValidTab(): SpatialAnalysisPanelTab {
    if (hasFacilities.value) return "facilities";
    if (hasCountyScores.value) return "counties";
    if (hasParcels.value) return "parcels";
    return "overview";
  }

  watch(
    [hasAnyResults, hasFacilities, hasParcels, hasCountyScores],
    ([nextHasAnyResults]) => {
      if (!nextHasAnyResults) {
        activeTab.value = "overview";
        return;
      }

      if (!hasFacilities.value && activeTab.value === "facilities") {
        activeTab.value = firstValidTab();
        return;
      }

      if (!hasParcels.value && activeTab.value === "parcels") {
        activeTab.value = firstValidTab();
        return;
      }

      if (!hasCountyScores.value && activeTab.value === "counties") {
        activeTab.value = firstValidTab();
      }
    },
    {
      immediate: true,
    }
  );

  return {
    activeTab,
    countyScores,
    countyScoresError,
    countyScoresStatus,
    countyScoresStatusError,
    countySelectionCount,
    formatOverlapPercent,
    hasAnyResults,
    hasColocation,
    hasCountyScores,
    hasFacilities,
    hasHyperscale,
    hasMarkets,
    hasParcels,
    marketSelectionUnavailableReason,
    matchedMarkets,
    orderedFacilities,
    orderedParcels,
    panelSummary,
    panelWidthClass,
    parcelOverview,
    progressPercentText,
    progressStageDotClass,
    progressStageStatusLabel,
    progressStatusText,
    summaryChips,
    tabClass,
    tabItems,
    visibleProgressStages,
  };
}
