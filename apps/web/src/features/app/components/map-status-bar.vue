<script setup lang="ts">
  import type { MapStatusBarProps } from "@/features/app/components/map-status-bar.types";

  const props = defineProps<MapStatusBarProps>();
</script>

<template>
  <div
    class="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur-sm"
  >
    Esc clears drawing/selection, then Scanner, then Quick View
    <span v-if="props.overlayStatusMessage !== null"> · {{ props.overlayStatusMessage }}</span>
  </div>
</template>
