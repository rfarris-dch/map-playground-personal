<script setup lang="ts">
  import { toRef } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import type {
    SelectionToolProgress,
    SelectionToolSummary,
  } from "@/features/selection-tool/selection-tool.types";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";
  import { useSpatialAnalysisPanelPresentation } from "@/features/spatial-analysis/use-spatial-analysis-panel-presentation";

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

  const { dashboardDisabled, exportDisabled, formatFacilityPower, subtitle, title } =
    useSpatialAnalysisPanelPresentation({
      isLoading: toRef(() => props.isLoading),
      mode: "summary",
      summary: toRef(() => props.summary),
    });
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
    :dashboard-disabled="dashboardDisabled"
    export-label="Export Facilities"
    :export-disabled="exportDisabled"
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
