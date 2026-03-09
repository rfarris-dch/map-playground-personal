<script setup lang="ts">
  import { Crosshair, Eye, EyeOff, PenTool, ScanSearch } from "lucide-vue-next";
  import Button from "@/components/ui/button/button.vue";
  import type {
    MapOverlayActionsEmits,
    MapOverlayActionsProps,
  } from "@/features/app/components/map-overlay-actions.types";

  const props = defineProps<MapOverlayActionsProps>();
  const emit = defineEmits<MapOverlayActionsEmits>();
</script>

<template>
  <div class="map-quick-actions pointer-events-auto absolute z-40 flex gap-1.5">
    <Button
      size="sm"
      :variant="props.quickViewActive ? 'glass-active' : 'glass'"
      :disabled="props.quickViewDisabledReason !== null"
      :title="props.quickViewDisabledReason ?? undefined"
      @click="emit('toggle-quick-view')"
    >
      <EyeOff v-if="props.quickViewActive" class="mr-1.5 h-3.5 w-3.5" />
      <Eye v-else class="mr-1.5 h-3.5 w-3.5" />
      Quick View
      <span class="ml-1 text-[10px] text-muted-foreground">(G)</span>
    </Button>
    <Button
      size="sm"
      :variant="props.sketchMeasureActive ? 'glass-active' : 'glass'"
      @click="emit('toggle-sketch-measure-panel')"
    >
      <PenTool class="mr-1.5 h-3.5 w-3.5" />
      Sketch / Measure
    </Button>
    <Button
      size="sm"
      :variant="props.selectionActive ? 'glass-active' : 'glass'"
      :disabled="props.selectionDisabledReason !== null"
      :title="props.selectionDisabledReason ?? undefined"
      @click="emit('toggle-selection-panel')"
    >
      <Crosshair class="mr-1.5 h-3.5 w-3.5" />
      Selection
    </Button>
    <Button
      size="sm"
      :variant="props.scannerActive ? 'glass-active' : 'glass'"
      :title="props.overlaysBlockedReason ?? undefined"
      @click="emit('toggle-scanner')"
    >
      <ScanSearch class="mr-1.5 h-3.5 w-3.5" />
      Scanner
      <span class="ml-1 text-[10px] text-muted-foreground">(V)</span>
    </Button>
  </div>
</template>
