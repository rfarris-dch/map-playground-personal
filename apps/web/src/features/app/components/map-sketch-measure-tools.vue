<script setup lang="ts">
  import { useGsapTransition } from "@/composables/use-gsap-transition";
  import type {
    MapSketchMeasureToolsEmits,
    MapSketchMeasureToolsProps,
  } from "@/features/app/components/map-sketch-measure-tools.types";
  import SketchMeasureToolbar from "@/features/sketch-measure/components/sketch-measure-toolbar.vue";

  const props = defineProps<MapSketchMeasureToolsProps>();
  const emit = defineEmits<MapSketchMeasureToolsEmits>();

  const toolbarTransition = useGsapTransition({
    enter: { from: { y: 20, opacity: 0, scale: 0.95 }, duration: 0.3, ease: "back.out(1.4)" },
    leave: { to: { y: 12, opacity: 0 }, duration: 0.2, ease: "power2.in" },
  });
</script>

<template>
  <Transition
    :css="false"
    @before-enter="toolbarTransition.onBeforeEnter"
    @enter="toolbarTransition.onEnter"
    @leave="toolbarTransition.onLeave"
  >
    <SketchMeasureToolbar
      v-if="props.isSketchMeasurePanelOpen"
      :state="props.sketchMeasureState"
      @set-mode="emit('set-mode', $event)"
      @set-area-shape="emit('set-area-shape', $event)"
      @finish="emit('finish')"
      @clear="emit('clear')"
      @use-as-selection="emit('use-as-selection')"
    />
  </Transition>
</template>
