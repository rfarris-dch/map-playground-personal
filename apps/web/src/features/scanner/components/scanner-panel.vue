<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import type { ScannerSummary } from "@/features/scanner/scanner.types";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";

  interface ScannerPanelProps {
    readonly emptyMessage?: string | null;
    readonly isFiltered: boolean;
    readonly isParcelsLoading: boolean;
    readonly parcelsErrorMessage: string | null;
    readonly summary: ScannerSummary;
  }

  const props = defineProps<ScannerPanelProps>();

  const emit = defineEmits<{
    close: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const subtitle = computed(() => {
    const filteredSuffix = props.isFiltered ? " · filtered" : "";
    return `${props.summary.totalCount} facilities, ${props.summary.parcelSelection.count} parcels in current viewport${filteredSuffix}`;
  });
  const title = computed(() => {
    if (props.summary.totalCount <= 0) {
      return "Scanner";
    }

    return `Scanner · ${props.summary.totalCount} Facilities`;
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
    :dashboard-disabled="props.summary.totalCount === 0 && props.summary.parcelSelection.count === 0"
    export-label="Export Facilities"
    :export-disabled="props.summary.totalCount === 0"
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
