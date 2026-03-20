<script setup lang="ts">
  import { useGsapTransition } from "@/composables/use-gsap-transition";
  import type { MapStatusBarProps } from "@/features/app/components/map-status-bar.types";

  const props = defineProps<MapStatusBarProps>();

  const statusTransition = useGsapTransition({
    enter: { from: { y: 12, opacity: 0 }, duration: 0.25, ease: "power2.out" },
    leave: { to: { y: 8, opacity: 0 }, duration: 0.18, ease: "power2.in" },
  });
</script>

<template>
  <Transition
    :css="false"
    @before-enter="statusTransition.onBeforeEnter"
    @enter="statusTransition.onEnter"
    @leave="statusTransition.onLeave"
  >
    <div
      v-if="props.overlayStatusMessage !== null"
      class="map-glass-subtle pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-xs text-muted-foreground"
    >
      {{ props.overlayStatusMessage }}
    </div>
  </Transition>
</template>
