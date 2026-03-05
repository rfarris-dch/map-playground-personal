<script setup lang="ts">
  import { TabsRoot } from "reka-ui";

  interface TabsProps {
    modelValue: string;
  }

  interface TabsEmits {
    "update:modelValue": [nextValue: string];
  }

  const props = defineProps<TabsProps>();
  const emit = defineEmits<TabsEmits>();

  function handleModelValue(nextValue: string): void {
    emit("update:modelValue", nextValue);
  }
</script>

<template>
  <TabsRoot :model-value="props.modelValue" class="w-full" @update:model-value="handleModelValue">
    <slot />
  </TabsRoot>
</template>
