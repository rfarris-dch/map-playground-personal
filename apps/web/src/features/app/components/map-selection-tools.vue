<script setup lang="ts">
  import type {
    MapSelectionToolsEmits,
    MapSelectionToolsProps,
  } from "@/features/app/components/map-selection-tools.types";
  import SelectionPanel from "@/features/selection/components/selection-panel.vue";

  const props = defineProps<MapSelectionToolsProps>();
  const emit = defineEmits<MapSelectionToolsEmits>();
</script>

<template>
  <SelectionPanel
    v-if="props.isSelectionPanelOpen && props.selectionGeometry !== null"
    :selection-geometry="props.selectionGeometry"
    :summary="props.selectionSummary"
    :error-message="props.selectionError"
    :is-loading="props.isLoading"
    @clear="emit('clear-selection')"
    @export="emit('export')"
    @open-dashboard="emit('open-dashboard')"
    @select-facility="emit('select-facility', $event)"
  />
</template>
