<script setup lang="ts">
  import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";
  import { computed } from "vue";

  interface SliderProps {
    readonly max?: number;
    readonly min?: number;
    readonly modelValue: number[];
    readonly step?: number;
  }

  const props = withDefaults(defineProps<SliderProps>(), {
    min: 0,
    max: 100,
    step: 1,
  });

  const emit = defineEmits<{
    "update:modelValue": [value: number[]];
  }>();

  const value = computed({
    get: () => props.modelValue,
    set: (v: number[]) => emit("update:modelValue", v),
  });
</script>

<template>
  <SliderRoot
    v-model="value"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    class="relative flex w-full touch-none select-none items-center"
  >
    <SliderTrack class="relative h-1 w-full grow overflow-hidden rounded-full bg-border">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, i) in value"
      :key="i"
      class="block size-3.5 rounded-full border-2 border-primary bg-background shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    />
  </SliderRoot>
</template>
