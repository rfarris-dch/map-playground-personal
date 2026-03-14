<script setup lang="ts">
  import { toRef } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import type {
    SelectionToolAnalysisSummary,
    SelectionToolProgress,
  } from "@/features/selection-tool/selection-tool.types";
  import type { SketchAreaGeometry } from "@/features/sketch-measure/sketch-measure.types";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";
  import { useSpatialAnalysisPanelPresentation } from "@/features/spatial-analysis/use-spatial-analysis-panel-presentation";

  interface SelectionPanelProps {
    readonly countyIds: readonly string[];
    readonly errorMessage: string | null;
    readonly isLoading: boolean;
    readonly progress: SelectionToolProgress | null;
    readonly selectionGeometry: SketchAreaGeometry | null;
    readonly summary: SelectionToolAnalysisSummary | null;
  }

  const props = defineProps<SelectionPanelProps>();

  const emit = defineEmits<{
    clear: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const { dashboardDisabled, exportDisabled, formatFacilityPower, subtitle, title } =
    useSpatialAnalysisPanelPresentation({
      countyIds: toRef(() => props.countyIds),
      isLoading: toRef(() => props.isLoading),
      mode: "selection",
      selectionGeometry: toRef(() => props.selectionGeometry),
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
    dismiss-label="Clear Selection"
    dashboard-label="Open Dashboard"
    :dashboard-disabled="dashboardDisabled"
    export-label="Export Facilities"
    :export-disabled="exportDisabled"
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
