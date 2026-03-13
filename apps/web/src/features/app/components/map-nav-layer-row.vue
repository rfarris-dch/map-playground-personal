<script setup lang="ts">
  import { computed } from "vue";
  import MapNavIcon from "@/components/icons/map-nav-icon.vue";

  interface MapNavLayerRowProps {
    readonly actionable?: boolean;
    readonly label: string;
    readonly visible: boolean;
  }

  interface MapNavLayerRowEmits {
    toggle: [];
  }

  const props = withDefaults(defineProps<MapNavLayerRowProps>(), {
    actionable: true,
  });

  const emit = defineEmits<MapNavLayerRowEmits>();

  const eyeColorClass = computed(() =>
    props.visible ? "text-foreground/75" : "text-muted-foreground"
  );
  const rowStateClass = computed(() =>
    props.visible ? "text-foreground/85" : "text-foreground/70"
  );

  function handleToggle(): void {
    if (!props.actionable) {
      return;
    }

    emit("toggle");
  }
</script>

<template>
  <div
    class="flex h-10 items-center bg-card px-2 transition-colors duration-150"
    :class="props.actionable ? 'hover:bg-background' : ''"
  >
    <div class="flex w-full items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="h-3 w-3 rounded-full bg-muted" aria-hidden="true" />
        <span class="text-sm font-medium leading-none" :class="rowStateClass"
          >{{ props.label }}</span
        >
      </div>

      <button
        v-if="props.actionable"
        type="button"
        class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        :aria-label="`${props.visible ? 'Hide' : 'Show'} ${props.label}`"
        @click="handleToggle"
      >
        <MapNavIcon name="eye" class="h-4 w-4" :class="eyeColorClass" />
      </button>

      <span v-else class="flex size-6 items-center justify-center" aria-hidden="true">
        <MapNavIcon name="eye" class="h-4 w-4 text-foreground/70" />
      </span>
    </div>
  </div>
</template>
