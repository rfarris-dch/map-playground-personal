<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import type {
    SelectionToolProgress,
    SelectionToolSummary,
  } from "@/features/selection-tool/selection-tool.types";
  import { formatArea, formatDistance } from "@/features/sketch-measure/sketch-measure.service";
  import type { SketchAreaGeometry } from "@/features/sketch-measure/sketch-measure.types";
  import SpatialAnalysisPanel from "@/features/spatial-analysis/components/spatial-analysis-panel.vue";

  interface SelectionPanelProps {
    readonly errorMessage: string | null;
    readonly isLoading: boolean;
    readonly progress: SelectionToolProgress | null;
    readonly selectionGeometry: SketchAreaGeometry | null;
    readonly summary: SelectionToolSummary | null;
  }

  const props = defineProps<SelectionPanelProps>();

  const emit = defineEmits<{
    clear: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const title = computed(() => {
    const facilityCount = props.summary?.totalCount ?? 0;
    const marketCount = props.summary?.marketSelection.matchCount ?? 0;
    if (facilityCount <= 0 && marketCount <= 0) {
      return "Selection";
    }

    return `Selection · ${facilityCount} Facilities · ${marketCount} Markets`;
  });

  const subtitle = computed(() => {
    const selectionGeometry = props.selectionGeometry;
    if (props.isLoading) {
      return "Loading analysis for the committed selection geometry…";
    }

    if (selectionGeometry === null) {
      return "Commit a sketch as a selection to analyze facilities and parcels.";
    }

    const facilityCount = props.summary?.totalCount ?? 0;
    const marketCount = props.summary?.marketSelection.matchCount ?? 0;
    const parcelCount = props.summary?.parcelSelection.count ?? 0;
    const shapeLabel =
      selectionGeometry.areaShape === "freeform" ? "polygon" : selectionGeometry.areaShape;

    return `${shapeLabel} · ${formatArea(selectionGeometry.areaSqKm)} · ${formatDistance(selectionGeometry.distanceKm)} · ${facilityCount} facilities, ${marketCount} markets, ${parcelCount} parcels`;
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
    dismiss-label="Clear Selection"
    dashboard-label="Open Dashboard"
    :dashboard-disabled="props.isLoading
      || (
        (props.summary?.totalCount ?? 0) === 0
        && (props.summary?.parcelSelection.count ?? 0) === 0
        && (props.summary?.marketSelection.matchCount ?? 0) === 0
      )"
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
