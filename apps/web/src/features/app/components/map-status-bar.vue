<script setup lang="ts">
  import type { MapStatusBarProps } from "@/features/app/components/map-status-bar.types";

  const props = defineProps<MapStatusBarProps>();
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="props.overlayStatusMessage !== null"
      class="map-glass-subtle pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-xs text-muted-foreground"
    >
      {{ props.overlayStatusMessage }}
    </div>
  </Transition>
</template>
