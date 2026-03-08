<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import type {
    SelectionToolProgress,
    SelectionToolSummary,
  } from "@/features/selection-tool/selection-tool.types";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";

  interface SelectionSummaryPanelProps {
    readonly errorMessage: string | null;
    readonly isLoading: boolean;
    readonly progress: SelectionToolProgress | null;
    readonly summary: SelectionToolSummary | null;
  }

  const props = defineProps<SelectionSummaryPanelProps>();

  const emit = defineEmits<{
    dismiss: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();
  const analysisSummary = computed(() => props.summary?.summary ?? null);

  const title = computed(() => {
    const facilityCount = analysisSummary.value?.totalCount ?? 0;
    const marketCount = analysisSummary.value?.marketSelection?.matchCount ?? 0;
    if (facilityCount <= 0 && marketCount <= 0) {
      return "Selection Summary";
    }

    return `Selection Summary · ${facilityCount} Facilities · ${marketCount} Markets`;
  });

  const subtitle = computed(() => {
    if (props.isLoading) {
      return "Loading facility, market, and parcel summaries for the selected geometry…";
    }

    const facilityCount = analysisSummary.value?.totalCount ?? 0;
    const marketCount = analysisSummary.value?.marketSelection?.matchCount ?? 0;
    const parcelCount = analysisSummary.value?.parcelSelection.count ?? 0;
    return `${facilityCount} facilities, ${marketCount} markets, ${parcelCount} parcels in selected geometry`;
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
</script>

<template>
  <SpatialAnalysisPanel
    :title="title"
    :subtitle="subtitle"
    :summary="props.summary"
    :error-message="props.errorMessage"
    :is-loading="props.isLoading"
    :progress="props.progress"
    empty-message="No facilities, markets, or parcels in this selection."
    dismiss-label="Close"
    dashboard-label="Open Dashboard"
    :dashboard-disabled="props.isLoading
      || (
        (analysisSummary?.totalCount ?? 0) === 0
        && (analysisSummary?.parcelSelection.count ?? 0) === 0
        && (analysisSummary?.marketSelection?.matchCount ?? 0) === 0
      )"
    export-label="Export Facilities"
    :export-disabled="props.isLoading || (analysisSummary?.totalCount ?? 0) === 0"
    :format-power="formatMeasurePowerMw"
    :format-facility-power="formatFacilityPower"
    facilities-power-heading="Comm/Own (MW)"
    facilities-perspective-display="dot"
    perspective-power-label="Commissioned"
    @dismiss="emit('dismiss')"
    @export="emit('export')"
    @open-dashboard="emit('open-dashboard')"
    @select-facility="emit('select-facility', $event)"
  />
</template>
