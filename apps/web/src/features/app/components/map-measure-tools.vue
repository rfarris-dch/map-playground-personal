<script setup lang="ts">
  import { PanelLeftClose, PanelLeftOpen } from "lucide-vue-next";
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
  <button
    type="button"
    class="pointer-events-auto absolute bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-md border border-border/90 bg-card/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-sm transition hover:bg-card"
    :aria-expanded="props.isPanelOpen"
    aria-controls="measure-tools-panel"
    :aria-label="props.isPanelOpen ? 'Close measurement tools panel' : 'Open measurement tools panel'"
    @click="emit('toggle-panel')"
  >
    <PanelLeftClose v-if="props.isPanelOpen" class="h-4 w-4" aria-hidden="true" />
    <PanelLeftOpen v-else class="h-4 w-4" aria-hidden="true" />
    Measure
  </button>

  <MeasureToolbar
    v-if="props.isPanelOpen"
    id="measure-tools-panel"
    :state="props.measureState"
    @set-mode="emit('set-mode', $event)"
    @set-area-shape="emit('set-area-shape', $event)"
    @finish="emit('finish')"
    @clear="emit('clear')"
  />

  <MeasureAnalysisPanel
    v-if="props.measureState.selectionRing !== null"
    :summary="props.selectionSummary"
    :error-message="props.selectionError"
    :is-loading="props.isLoading"
    @clear="emit('clear')"
    @export="emit('export')"
    @select-facility="emit('select-facility', $event)"
  />
</template>
