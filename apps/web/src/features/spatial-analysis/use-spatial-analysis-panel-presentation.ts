import { computed, type Ref } from "vue";
import { formatArea, formatDistance } from "@/features/sketch-measure/sketch-measure.service";
import type { SketchAreaGeometry } from "@/features/sketch-measure/sketch-measure.types";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

interface UseSpatialAnalysisPanelPresentationOptions {
  readonly countyIds?: Ref<readonly string[]>;
  readonly isLoading: Ref<boolean>;
  readonly mode: "selection" | "summary";
  readonly selectionGeometry?: Ref<SketchAreaGeometry | null>;
  readonly summary: Ref<SpatialAnalysisSummaryModel | null>;
}

function formatFacilityPower(powerMw: number | null): string {
  if (powerMw === null || !Number.isFinite(powerMw) || powerMw <= 0) {
    return "-";
  }

  if (powerMw >= 1000) {
    return (powerMw / 1000).toFixed(1);
  }

  if (powerMw >= 100) {
    return `${Math.round(powerMw)}`;
  }

  return powerMw.toFixed(1);
}

export function useSpatialAnalysisPanelPresentation(
  options: UseSpatialAnalysisPanelPresentationOptions
) {
  const analysisSummary = computed(() => options.summary.value?.summary ?? null);
  const dashboardDisabled = computed(() => {
    if (options.isLoading.value) {
      return true;
    }

    const summary = analysisSummary.value;
    if (summary === null) {
      return options.mode === "selection" && (options.countyIds?.value.length ?? 0) === 0;
    }

    const hasResults =
      summary.totalCount > 0 ||
      summary.parcelSelection.count > 0 ||
      (summary.marketSelection?.matchCount ?? 0) > 0;

    if (hasResults) {
      return false;
    }

    if (options.mode === "selection") {
      return (
        (options.summary.value?.area.countyIds.length ?? options.countyIds?.value.length ?? 0) === 0
      );
    }

    return true;
  });
  const exportDisabled = computed(() => {
    return options.isLoading.value || (analysisSummary.value?.totalCount ?? 0) === 0;
  });
  const title = computed(() => {
    const facilityCount = analysisSummary.value?.totalCount ?? 0;
    const marketCount = analysisSummary.value?.marketSelection?.matchCount ?? 0;
    if (facilityCount <= 0 && marketCount <= 0) {
      return options.mode === "selection" ? "Selection" : "Selection Summary";
    }

    const prefix = options.mode === "selection" ? "Selection" : "Selection Summary";
    return `${prefix} · ${facilityCount} Facilities · ${marketCount} Markets`;
  });
  const subtitle = computed(() => {
    if (options.mode === "selection") {
      const selectionGeometry = options.selectionGeometry?.value ?? null;
      if (options.isLoading.value) {
        return "Loading analysis for the committed selection geometry…";
      }

      if (selectionGeometry === null) {
        return "Commit a sketch as a selection to analyze facilities and parcels.";
      }

      const facilityCount = analysisSummary.value?.totalCount ?? 0;
      const marketCount = analysisSummary.value?.marketSelection?.matchCount ?? 0;
      const parcelCount = analysisSummary.value?.parcelSelection.count ?? 0;
      const shapeLabel =
        selectionGeometry.areaShape === "freeform" ? "polygon" : selectionGeometry.areaShape;

      return `${shapeLabel} · ${formatArea(selectionGeometry.areaSqKm)} · ${formatDistance(selectionGeometry.distanceKm)} · ${facilityCount} facilities, ${marketCount} markets, ${parcelCount} parcels`;
    }

    if (options.isLoading.value) {
      return "Loading facility, market, and parcel summaries for the selected geometry…";
    }

    const facilityCount = analysisSummary.value?.totalCount ?? 0;
    const marketCount = analysisSummary.value?.marketSelection?.matchCount ?? 0;
    const parcelCount = analysisSummary.value?.parcelSelection.count ?? 0;
    return `${facilityCount} facilities, ${marketCount} markets, ${parcelCount} parcels in selected geometry`;
  });

  return {
    analysisSummary,
    dashboardDisabled,
    exportDisabled,
    formatFacilityPower,
    subtitle,
    title,
  };
}
