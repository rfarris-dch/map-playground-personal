<script setup lang="ts">
  import { computed } from "vue";
  import Switch from "@/components/ui/switch/switch.vue";

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

      <Switch
        v-if="props.actionable"
        :checked="props.visible"
        :aria-label="`${props.visible ? 'Hide' : 'Show'} ${props.label}`"
        @update:checked="handleToggle"
      />
    </div>
  </div>
</template>
