import { computed, shallowRef } from "vue";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
import type { ScannerFacility } from "@/features/scanner/scanner.types";
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

type ScannerTab = "colocation" | "facilities" | "hyperscale" | "overview";

interface MetricRow {
  readonly label: string;
  readonly value: string;
}

export interface ProviderWithPipeline {
  readonly commissionedPowerMw: number;
  readonly count: number;
  readonly pipelinePowerMw: number;
  readonly providerName: string;
}

function isScannerFacility(facility: SpatialAnalysisFacilityRecord): facility is ScannerFacility {
  return "facilityCode" in facility;
}

function readFacilityCode(facility: SpatialAnalysisFacilityRecord): string | null {
  return isScannerFacility(facility) ? facility.facilityCode : null;
}

function buildProvidersWithPipeline(
  facilities: readonly SpatialAnalysisFacilityRecord[],
  perspective: "colocation" | "hyperscale"
): readonly ProviderWithPipeline[] {
  const lookup = new Map<string, { commissionedPowerMw: number; count: number; pipelinePowerMw: number }>();

  for (const facility of facilities) {
    if (facility.perspective !== perspective) {
      continue;
    }

    const key = facility.providerName ?? "Unknown";
    const current = lookup.get(key) ?? { commissionedPowerMw: 0, count: 0, pipelinePowerMw: 0 };
    const commissioned = typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0;
    const planned = typeof facility.plannedPowerMw === "number" ? facility.plannedPowerMw : 0;
    const uc = typeof facility.underConstructionPowerMw === "number" ? facility.underConstructionPowerMw : 0;

    lookup.set(key, {
      commissionedPowerMw: current.commissionedPowerMw + commissioned,
      count: current.count + 1,
      pipelinePowerMw: current.pipelinePowerMw + planned + uc,
    });
  }

  return [...lookup.entries()]
    .map(([providerName, summary]) => ({
      commissionedPowerMw: summary.commissionedPowerMw,
      count: summary.count,
      pipelinePowerMw: summary.pipelinePowerMw,
      providerName,
    }))
    .sort((left, right) => {
      const totalLeft = left.commissionedPowerMw + left.pipelinePowerMw;
      const totalRight = right.commissionedPowerMw + right.pipelinePowerMw;
      if (totalRight !== totalLeft) {
        return totalRight - totalLeft;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.providerName.localeCompare(right.providerName);
    })
    .slice(0, 3);
}

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
    // biome-ignore lint/style/useUnifiedTypeSignatures: Vue defineEmits produces per-event overloads
    (e: "close"): void;
    (e: "export"): void;
    (e: "open-dashboard"): void;
    (e: "select-facility", facility: SelectedFacilityRef): void;
  }
) {
  const activeTab = shallowRef<ScannerTab>("overview");
  const minimized = shallowRef(false);
  const topCompaniesExpanded = shallowRef(false);
  const analysisSummary = computed(() => props.summary.summary);

  function toggleMinimized(): void {
    minimized.value = !minimized.value;
  }

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
      countyCount.value > 0 ||
      marketCount.value > 0
  );

  const topFacilities = computed(() => analysisSummary.value.facilities.slice(0, 15));
  const facilitiesTabDisabled = computed(() => topFacilities.value.length === 0);
  const dashboardDisabled = computed(
    () =>
      analysisSummary.value.totalCount === 0 &&
      analysisSummary.value.parcelSelection.count === 0 &&
      marketCount.value === 0 &&
      countyCount.value === 0
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

  const topProvidersWithPipeline = computed(() =>
    buildProvidersWithPipeline(analysisSummary.value.facilities, "colocation")
  );

  const topUsersWithPipeline = computed(() =>
    buildProvidersWithPipeline(analysisSummary.value.facilities, "hyperscale")
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
      value: formatScannerPowerMw(analysisSummary.value.colocation.plannedPowerMw),
    },
    {
      label: "Under Construction Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.colocation.underConstructionPowerMw),
    },
    {
      label: "Available Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.colocation.availablePowerMw),
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
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.plannedPowerMw),
    },
    {
      label: "Under Construction Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.underConstructionPowerMw),
    },
    {
      label: "Available Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.availablePowerMw),
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
    minimized,
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
    topProvidersWithPipeline,
    topUsersWithPipeline,
    colocationMetrics,
    hyperscaleMetrics,
    readFacilityCode,
    selectFacility,
    tabClass,
    setActiveTab,
    toggleMinimized,
  };
}
