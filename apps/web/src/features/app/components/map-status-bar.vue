<script setup lang="ts">
  import type { MapStatusBarProps } from "@/features/app/components/map-status-bar.types";

  const props = defineProps<MapStatusBarProps>();
</script>

<template>
  <div
    class="map-glass-pill pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] text-muted-foreground"
  >
    Esc clears drawing/selection, then Scanner, then Quick View
    <span v-if="props.overlayStatusMessage !== null"> · {{ props.overlayStatusMessage }}</span>
  </div>
</template>
