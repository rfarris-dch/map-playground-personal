<script setup lang="ts">
  import type {
    MapMeasureToolsEmits,
    MapMeasureToolsProps,
  } from "@/features/app/components/map-measure-tools.types";
  import MeasureAnalysisPanel from "@/features/measure/components/measure-analysis-panel.vue";
  import MeasureToolbar from "@/features/measure/components/measure-toolbar.vue";

  const props = defineProps<MapMeasureToolsProps>();
  const emit = defineEmits<MapMeasureToolsEmits>();
</script>

<template>
  <MeasureToolbar
    v-if="props.isPanelOpen"
    id="measure-tools-panel"
    :image-subject="props.measureSelectionImageSubject"
    :state="props.measureState"
    :output-mode="props.measureSelectionOutputMode"
    @set-mode="emit('set-mode', $event)"
    @set-area-shape="emit('set-area-shape', $event)"
    @set-image-subject="emit('set-image-subject', $event)"
    @set-output-mode="emit('set-output-mode', $event)"
    @finish="emit('finish')"
    @clear="emit('clear')"
  />

  <MeasureAnalysisPanel
    v-if="
      props.measureSelectionOutputMode === 'analysis' && props.measureState.selectionRing !== null
    "
    :summary="props.selectionSummary"
    :error-message="props.selectionError"
    :is-loading="props.isLoading"
    @clear="emit('clear')"
    @export="emit('export')"
    @open-dashboard="emit('open-dashboard')"
    @select-facility="emit('select-facility', $event)"
  />
</template>
