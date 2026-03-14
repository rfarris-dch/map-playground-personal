<script setup lang="ts">
  import { provide } from "vue";
  import MapPageControls from "@/features/app/components/map-page-controls.vue";
  import MapPageOverlays from "@/features/app/components/map-page-overlays.vue";
  import { MAP_SHELL_KEY } from "@/features/app/core/map-shell-context";
  import { useAppShell } from "@/features/app/core/use-app-shell";
  import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";

  const shell = useAppShell();

  provide(MAP_FILTERS_KEY, shell.mapFilters);
  provide(MAP_SHELL_KEY, shell);
</script>

<template>
  <main class="h-full w-full">
    <section
      ref="map-container"
      class="map-page-shell relative h-full w-full"
      aria-label="Map preview"
    >
      <MapPageControls />
      <MapPageOverlays />
    </section>
  </main>
</template>

<style>
  .map-quick-actions {
    top: 0.75rem;
    right: 0.75rem;
  }

  .map-page-shell .maplibregl-ctrl-top-right {
    top: 3.9rem;
    right: 0.75rem;
  }

  .map-page-shell .maplibregl-canvas {
    transition: filter 180ms ease;
  }
</style>
