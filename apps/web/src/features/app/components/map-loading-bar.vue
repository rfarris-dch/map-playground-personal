<script setup lang="ts">
  interface MapLoadingBarProps {
    readonly active: boolean;
  }

  defineProps<MapLoadingBarProps>();
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-500 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="active" class="pointer-events-none absolute inset-x-0 top-0 z-40">
      <div class="map-loading-bar h-[2px] w-full bg-transparent">
        <div class="map-loading-bar-indicator h-full rounded-full bg-primary/70" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
  .map-loading-bar-indicator {
    width: 40%;
    animation: map-loading-slide 1.2s ease-in-out infinite;
  }

  @keyframes map-loading-slide {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(150%);
    }
    100% {
      transform: translateX(350%);
    }
  }
</style>
