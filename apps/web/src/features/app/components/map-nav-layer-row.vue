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

  const eyeColorClass = computed(() => (props.visible ? "text-[#475569]" : "text-[#CBD5E1]"));
  const rowStateClass = computed(() => (props.visible ? "text-[#334155]" : "text-[#94A3B8]"));

  function handleToggle(): void {
    if (!props.actionable) {
      return;
    }

    emit("toggle");
  }
</script>

<template>
  <div
    class="flex h-10 items-center bg-white px-2 transition-colors"
    :class="props.actionable ? 'hover:bg-[#F8FAFC]' : ''"
  >
    <div class="flex w-full items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="h-3 w-3 rounded-full bg-[#EEEEEE]" aria-hidden="true" />
        <span class="text-sm font-medium leading-none" :class="rowStateClass"
          >{{ props.label }}</span
        >
      </div>

      <button
        v-if="props.actionable"
        type="button"
        class="flex size-6 items-center justify-center rounded-[4px] transition-colors hover:bg-[#F8FAFC]"
        :aria-label="`${props.visible ? 'Hide' : 'Show'} ${props.label}`"
        @click="handleToggle"
      >
        <MapNavIcon name="eye" class="h-[9.672px] w-4" :class="eyeColorClass" />
      </button>

      <span v-else class="flex size-6 items-center justify-center" aria-hidden="true">
        <MapNavIcon name="eye" class="h-[9.672px] w-4 text-[#94A3B8]" />
      </span>
    </div>
  </div>
</template>
