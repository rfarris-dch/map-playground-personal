import { computed, shallowRef } from "vue";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";
import { buildDonutChartArcSegments } from "@/lib/donut-chart.service";

export interface ScannerPanelProps {
  readonly countyIds: readonly string[];
  readonly emptyMessage: string | null;
  readonly isFiltered: boolean;
  readonly isParcelsLoading: boolean;
  readonly parcelsErrorMessage: string | null;
  readonly summary: SpatialAnalysisSummaryModel;
}

export type ScannerTab = "colocation" | "facilities" | "hyperscale" | "overview";

export interface MetricRow {
  readonly label: string;
  readonly value: string;
}

// Donut chart helpers — use OKLCH shades derived from the colocation/hyperscale tokens
const COLO_SHADES = [
  "oklch(0.62 0.14 250)",
  "oklch(0.76 0.10 250)",
  "oklch(0.90 0.05 250)",
] as const;
const HYPER_SHADES = [
  "oklch(0.65 0.15 162)",
  "oklch(0.78 0.10 162)",
  "oklch(0.92 0.05 162)",
] as const;

function donutSegments(commissioned: number, uc: number, planned: number, isColo: boolean) {
  const shades = isColo ? COLO_SHADES : HYPER_SHADES;
  return buildDonutChartArcSegments({
    centerX: 50,
    centerY: 50,
    radius: 36,
    segments: [
      { color: shades[0], value: commissioned },
      { color: shades[1], value: uc },
      { color: shades[2], value: planned },
    ],
  });
}

export function useScannerPanelModel(
  props: ScannerPanelProps,
  emit: {
    (e: "close" | "export" | "open-dashboard"): void;
    (e: "select-facility", facility: SelectedFacilityRef): void;
  }
) {
  const activeTab = shallowRef<ScannerTab>("overview");
  const topCompaniesExpanded = shallowRef(false);
  const analysisSummary = computed(() => props.summary.summary);

  const totalCount = computed(() => analysisSummary.value.totalCount);
  const marketCount = computed(() => analysisSummary.value.marketSelection?.matchCount ?? 0);

  const headerSubtitle = computed(() => {
    const f = totalCount.value;
    const m = marketCount.value;
    return `${f} ${f === 1 ? "Facility" : "Facilities"} \u2022 ${m} ${m === 1 ? "Market" : "Markets"}`;
  });

  const countyCount = computed(() => {
    const ids = props.summary.area.countyIds;
    return ids.length > 0 ? ids.length : props.countyIds.length;
  });

  const hasResults = computed(
    () =>
      analysisSummary.value.totalCount > 0 ||
      analysisSummary.value.parcelSelection.count > 0 ||
      countyCount.value > 0
  );

  const topFacilities = computed(() => analysisSummary.value.facilities.slice(0, 15));
  const facilitiesTabDisabled = computed(() => topFacilities.value.length === 0);
  const dashboardDisabled = computed(
    () =>
      analysisSummary.value.totalCount === 0 && analysisSummary.value.parcelSelection.count === 0
  );
  const exportDisabled = computed(() => analysisSummary.value.totalCount === 0);

  const coloDonut = computed(() =>
    donutSegments(
      analysisSummary.value.colocation.commissionedPowerMw,
      analysisSummary.value.colocation.pipelinePowerMw,
      0,
      true
    )
  );

  const hyperDonut = computed(() =>
    donutSegments(
      analysisSummary.value.hyperscale.commissionedPowerMw,
      analysisSummary.value.hyperscale.pipelinePowerMw,
      0,
      false
    )
  );

  const coloTotalMw = computed(
    () =>
      analysisSummary.value.colocation.commissionedPowerMw +
      analysisSummary.value.colocation.pipelinePowerMw
  );

  const hyperTotalMw = computed(
    () =>
      analysisSummary.value.hyperscale.commissionedPowerMw +
      analysisSummary.value.hyperscale.pipelinePowerMw
  );

  const colocationMetrics = computed<readonly MetricRow[]>(() => [
    { label: "Colocation Capacity Snapshot (MW)", value: "" },
    {
      label: "Provider Total Capacity (MW)",
      value: formatScannerPowerMw(
        analysisSummary.value.colocation.commissionedPowerMw +
          analysisSummary.value.colocation.pipelinePowerMw
      ),
    },
    {
      label: "Commissioned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.colocation.commissionedPowerMw),
    },
    {
      label: "Planned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.colocation.pipelinePowerMw),
    },
    {
      label: "Under Construction Power (MW)",
      value: `${analysisSummary.value.colocation.underConstructionCount}`,
    },
    {
      label: "Available Power (MW)",
      value: "\u2014",
    },
    {
      label: "Facility Count",
      value: `${analysisSummary.value.colocation.count}`,
    },
  ]);

  const hyperscaleMetrics = computed<readonly MetricRow[]>(() => [
    { label: "Hyperscale Capacity Snapshot (MW)", value: "" },
    {
      label: "User Total Capacity (MW)",
      value: formatScannerPowerMw(
        analysisSummary.value.hyperscale.commissionedPowerMw +
          analysisSummary.value.hyperscale.pipelinePowerMw
      ),
    },
    {
      label: "Commissioned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.commissionedPowerMw),
    },
    {
      label: "Planned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.pipelinePowerMw),
    },
    {
      label: "Under Construction Power (MW)",
      value: `${analysisSummary.value.hyperscale.underConstructionCount}`,
    },
    {
      label: "Available Power (MW)",
      value: "\u2014",
    },
    {
      label: "Facility Count",
      value: `${analysisSummary.value.hyperscale.count}`,
    },
  ]);

  function selectFacility(facility: SpatialAnalysisFacilityRecord): void {
    emit("select-facility", {
      facilityId: facility.facilityId,
      perspective: facility.perspective,
    });
  }

  function tabClass(tab: ScannerTab): string {
    if (activeTab.value === tab) {
      return "border-b-primary text-primary";
    }
    if (tab === "facilities" && facilitiesTabDisabled.value) {
      return "border-b-transparent text-border";
    }
    return "border-b-transparent text-muted-foreground hover:text-foreground/70";
  }

  function setActiveTab(tab: ScannerTab): void {
    if (tab === "facilities" && facilitiesTabDisabled.value) {
      return;
    }
    activeTab.value = tab;
  }

  return {
    activeTab,
    topCompaniesExpanded,
    analysisSummary,
    totalCount,
    marketCount,
    headerSubtitle,
    countyCount,
    hasResults,
    topFacilities,
    facilitiesTabDisabled,
    dashboardDisabled,
    exportDisabled,
    coloDonut,
    hyperDonut,
    coloTotalMw,
    hyperTotalMw,
    colocationMetrics,
    hyperscaleMetrics,
    selectFacility,
    tabClass,
    setActiveTab,
  };
}
