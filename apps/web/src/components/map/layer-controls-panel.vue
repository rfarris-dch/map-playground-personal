<script setup lang="ts">
  import { computed, toRef, useSlots } from "vue";
  import { useEmbeddedPanelClass } from "@/components/map/use-embedded-panel-class";

  interface LayerControlsPanelProps {
    readonly ariaLabel: string;
    readonly embedded?: boolean;
    readonly subtitle?: string;
    readonly title?: string;
  }

  const props = withDefaults(defineProps<LayerControlsPanelProps>(), {
    embedded: false,
  });

  const slots = useSlots();
  const containerClass = useEmbeddedPanelClass(toRef(() => props.embedded));
  const showHeader = computed(() => {
    return (
      !props.embedded &&
      (typeof props.title === "string" || typeof props.subtitle === "string" || slots.header)
    );
  });
</script>

<template>
  <aside :class="containerClass" :aria-label="props.ariaLabel">
    <header v-if="showHeader" class="mb-2 flex items-center justify-between">
      <slot name="header">
        <h2
          v-if="props.title"
          class="m-0 text-xs font-semibold tracking-wide text-muted-foreground"
        >
          {{ props.title }}
        </h2>
        <span v-if="props.subtitle" class="text-xs text-muted-foreground"
          >{{ props.subtitle }}</span
        >
      </slot>
    </header>

    <slot />
  </aside>
</template>
