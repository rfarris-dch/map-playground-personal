<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";
  import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

  interface MeasureAnalysisPanelProps {
    readonly errorMessage: string | null;
    readonly isLoading: boolean;
    readonly summary: MeasureSelectionSummary | null;
  }

  const props = defineProps<MeasureAnalysisPanelProps>();

  const emit = defineEmits<{
    clear: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const title = computed(() => {
    const facilityCount = props.summary?.totalCount ?? 0;
    if (facilityCount <= 0) {
      return "Selection Summary";
    }

    return `Selection Summary · ${facilityCount} Facilities`;
  });

  const subtitle = computed(() => {
    if (props.isLoading) {
      return "Loading selection summary for selected geometry…";
    }

    const facilityCount = props.summary?.totalCount ?? 0;
    const parcelCount = props.summary?.parcelSelection.count ?? 0;
    return `${facilityCount} facilities, ${parcelCount} parcels in selected geometry`;
  });

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

  const panelSummary = computed<SpatialAnalysisSummaryModel | null>(() => {
    if (props.summary === null) {
      return null;
    }

    return {
      area: {
        countyIds: props.summary.countyIds,
        selectionAreaSqKm: 0,
      },
      countyIntelligence: {
        requestedCountyIds: props.summary.countyIds,
        scores: null,
        scoresError: null,
        status: null,
        statusError: null,
        unavailableReason: null,
      },
      coverage: null,
      meta: null,
      policy: null,
      provenance: null,
      request: null,
      summary: {
        colocation: props.summary.colocation,
        facilities: props.summary.facilities,
        hyperscale: props.summary.hyperscale,
        parcelSelection: props.summary.parcelSelection,
        topColocationProviders: props.summary.topColocationProviders,
        topHyperscaleProviders: props.summary.topHyperscaleProviders,
        totalCount: props.summary.totalCount,
      },
      warnings: [],
    };
  });
</script>

<template>
  <SpatialAnalysisPanel
    :title="title"
    :subtitle="subtitle"
    :summary="panelSummary"
    :error-message="props.errorMessage"
    :is-loading="props.isLoading"
    empty-message="No facilities or parcels in this selection."
    dismiss-label="Clear"
    dashboard-label="Open Dashboard"
    :dashboard-disabled="props.isLoading || ((props.summary?.totalCount ?? 0) === 0 && (props.summary?.parcelSelection.count ?? 0) === 0)"
    export-label="Export Facilities"
    :export-disabled="props.isLoading || (props.summary?.totalCount ?? 0) === 0"
    :format-power="formatMeasurePowerMw"
    :format-facility-power="formatFacilityPower"
    facilities-power-heading="Comm/Own (MW)"
    facilities-perspective-display="dot"
    perspective-power-label="Commissioned"
    @dismiss="emit('clear')"
    @export="emit('export')"
    @open-dashboard="emit('open-dashboard')"
    @select-facility="emit('select-facility', $event)"
  />
</template>
