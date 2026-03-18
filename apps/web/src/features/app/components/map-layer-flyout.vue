<script setup lang="ts">
  interface MapLayerFlyoutProps {
    readonly flyoutId: string;
    readonly title?: string;
  }

  interface MapLayerFlyoutEmits {
    close: [];
  }

  const props = withDefaults(defineProps<MapLayerFlyoutProps>(), {
    title: "",
  });
  const emit = defineEmits<MapLayerFlyoutEmits>();
</script>

<template>
  <div
    class="map-glass-elevated pointer-events-auto ml-1.5 w-[320px] overflow-hidden rounded-2xl"
    style="max-height: calc(100vh - 6rem)"
    role="complementary"
    :aria-label="`${flyoutId} filters`"
  >
    <div
      v-if="props.title"
      class="flex h-11 items-center justify-between border-b border-border/30 px-4"
    >
      <span class="text-[13px] font-bold tracking-tight text-foreground/80">{{ props.title }}</span>
      <span
        class="flex size-5 cursor-pointer items-center justify-center rounded text-foreground/30 transition-colors hover:text-foreground/60"
        role="button"
        tabindex="0"
        aria-label="Close filter panel"
        @click="emit('close')"
        @keydown.enter="emit('close')"
      >
        <svg class="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
      </span>
    </div>
    <div class="overflow-y-auto scrollbar-hide p-4" style="max-height: calc(100vh - 8.5rem)">
      <slot />
    </div>
  </div>
</template>
