<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import type { MapInitErrorReason } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";

  interface MapInitErrorOverlayProps {
    readonly errorReason: MapInitErrorReason;
    readonly retrying: boolean;
  }

  const props = defineProps<MapInitErrorOverlayProps>();
  const emit = defineEmits<{ retry: [] }>();

  const errorHeading = computed(() => {
    switch (props.errorReason) {
      case "style-fetch":
        return "Map style failed to load";
      case "webgl":
        return "WebGL is not available";
      case "init":
        return "Map failed to initialize";
      default:
        return "Something went wrong";
    }
  });

  const errorDescription = computed(() => {
    switch (props.errorReason) {
      case "style-fetch":
        return "The basemap style could not be fetched. Check your network connection and try again.";
      case "webgl":
        return "Your browser or device does not support WebGL, which is required to render the map.";
      case "init":
        return "The map engine encountered an error during startup. Try reloading the page.";
      default:
        return "An unexpected error occurred while loading the map. Try again or reload the page.";
    }
  });

  const isRetryable = computed(() => props.errorReason !== "webgl");
</script>

<template>
  <div
    class="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    role="alert"
    aria-live="assertive"
  >
    <div
      class="map-glass-elevated flex max-w-sm flex-col items-center gap-4 rounded-lg border border-border/40 px-8 py-6 text-center shadow-lg"
    >
      <div class="flex flex-col gap-1.5">
        <h2 class="text-sm font-semibold text-foreground">{{ errorHeading }}</h2>
        <p class="text-xs leading-relaxed text-muted-foreground">{{ errorDescription }}</p>
      </div>

      <Button
        v-if="isRetryable"
        variant="default"
        size="sm"
        :disabled="props.retrying"
        @click="emit('retry')"
      >
        {{ props.retrying ? "Retrying..." : "Retry" }}
      </Button>
    </div>
  </div>
</template>
