<script setup lang="ts">
  import { Crosshair, Eye, EyeOff, PenTool, ScanSearch } from "lucide-vue-next";
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import type {
    MapOverlayActionsEmits,
    MapOverlayActionsProps,
  } from "@/features/app/components/map-overlay-actions.types";

  const props = defineProps<MapOverlayActionsProps>();
  const emit = defineEmits<MapOverlayActionsEmits>();

  const quickViewClass = computed(() =>
    props.quickViewActive
      ? "border border-cyan-500/30 bg-cyan-500/10 shadow-lg backdrop-blur-sm"
      : "border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm"
  );

  const sketchMeasureClass = computed(() =>
    props.sketchMeasureActive
      ? "border border-cyan-500/30 bg-cyan-500/10 shadow-lg backdrop-blur-sm"
      : "border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm"
  );

  const selectionClass = computed(() =>
    props.selectionActive
      ? "border border-cyan-500/30 bg-cyan-500/10 shadow-lg backdrop-blur-sm"
      : "border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm"
  );

  const scannerClass = computed(() =>
    props.scannerActive
      ? "border border-cyan-500/30 bg-cyan-500/10 shadow-lg backdrop-blur-sm"
      : "border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm"
  );
</script>

<template>
  <div class="map-quick-actions pointer-events-auto absolute z-40 flex gap-1.5">
    <Button
      size="sm"
      variant="secondary"
      :disabled="props.quickViewDisabledReason !== null"
      :title="props.quickViewDisabledReason ?? undefined"
      :class="quickViewClass"
      @click="emit('toggle-quick-view')"
    >
      <EyeOff v-if="props.quickViewActive" class="mr-1.5 h-3.5 w-3.5" />
      <Eye v-else class="mr-1.5 h-3.5 w-3.5" />
      Quick View
      <span class="ml-1 text-[10px] text-muted-foreground">(G)</span>
    </Button>
    <Button
      size="sm"
      variant="secondary"
      :class="sketchMeasureClass"
      @click="emit('toggle-sketch-measure-panel')"
    >
      <PenTool class="mr-1.5 h-3.5 w-3.5" />
      Sketch / Measure
    </Button>
    <Button
      size="sm"
      variant="secondary"
      :disabled="props.selectionDisabledReason !== null"
      :title="props.selectionDisabledReason ?? undefined"
      :class="selectionClass"
      @click="emit('toggle-selection-panel')"
    >
      <Crosshair class="mr-1.5 h-3.5 w-3.5" />
      Selection
    </Button>
    <Button
      size="sm"
      variant="secondary"
      :title="props.overlaysBlockedReason ?? undefined"
      :class="scannerClass"
      @click="emit('toggle-scanner')"
    >
      <ScanSearch class="mr-1.5 h-3.5 w-3.5" />
      Scanner
      <span class="ml-1 text-[10px] text-muted-foreground">(V)</span>
    </Button>
  </div>
</template>
