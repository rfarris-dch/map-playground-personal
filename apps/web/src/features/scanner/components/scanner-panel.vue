<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";
  import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

  interface ScannerPanelProps {
    readonly countyIds: readonly string[];
    readonly emptyMessage?: string | null;
    readonly isFiltered: boolean;
    readonly isParcelsLoading: boolean;
    readonly parcelsErrorMessage: string | null;
    readonly summary: SpatialAnalysisSummaryModel;
  }

  const props = defineProps<ScannerPanelProps>();

  const emit = defineEmits<{
    close: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();
  const analysisSummary = computed(() => props.summary.summary);

  const subtitle = computed(() => {
    const filteredSuffix = props.isFiltered ? " · filtered" : "";
    return `${analysisSummary.value.totalCount} facilities, ${analysisSummary.value.parcelSelection.count} parcels in current viewport${filteredSuffix}`;
  });
  const title = computed(() => {
    if (analysisSummary.value.totalCount <= 0) {
      return "Scanner";
    }

    return `Scanner · ${analysisSummary.value.totalCount} Facilities`;
  });

  const resolvedEmptyMessage = computed(() => {
    if (typeof props.emptyMessage === "string" && props.emptyMessage.length > 0) {
      return props.emptyMessage;
    }

    if (props.isParcelsLoading) {
      return "Loading parcels in current viewport…";
    }

    return "No facilities or parcels in this viewport.";
  });

  function formatFacilityPower(powerMw: number | null): string {
    return formatScannerPowerMw(powerMw ?? 0);
  }
</script>

<template>
  <SpatialAnalysisPanel
    :title="title"
    :subtitle="subtitle"
    :summary="props.summary"
    :error-message="props.parcelsErrorMessage"
    :is-loading="false"
    :is-parcels-loading="props.isParcelsLoading"
    :empty-message="resolvedEmptyMessage"
    dismiss-label="Close"
    dashboard-label="Open Dashboard"
    :dashboard-disabled="analysisSummary.totalCount === 0
      && analysisSummary.parcelSelection.count === 0
      && (props.summary.area.countyIds.length || props.countyIds.length) === 0"
    export-label="Export Facilities"
    :export-disabled="analysisSummary.totalCount === 0"
    :format-power="formatScannerPowerMw"
    :format-facility-power="formatFacilityPower"
    facilities-perspective-display="badge"
    :lease-semantic="false"
    :show-coordinates="true"
    perspective-power-label="Power"
    @dismiss="emit('close')"
    @export="emit('export')"
    @open-dashboard="emit('open-dashboard')"
    @select-facility="emit('select-facility', $event)"
  />
</template>
