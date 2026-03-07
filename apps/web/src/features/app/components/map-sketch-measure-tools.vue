<script setup lang="ts">
  import type {
    MapSketchMeasureToolsEmits,
    MapSketchMeasureToolsProps,
  } from "@/features/app/components/map-sketch-measure-tools.types";
  import SketchMeasureToolbar from "@/features/sketch-measure/components/sketch-measure-toolbar.vue";

  const props = defineProps<MapSketchMeasureToolsProps>();
  const emit = defineEmits<MapSketchMeasureToolsEmits>();
</script>

<template>
  <SketchMeasureToolbar
    v-if="props.isSketchMeasurePanelOpen"
    :state="props.sketchMeasureState"
    @set-mode="emit('set-mode', $event)"
    @set-area-shape="emit('set-area-shape', $event)"
    @finish="emit('finish')"
    @clear="emit('clear')"
    @use-as-selection="emit('use-as-selection')"
  />
</template>
