<script setup lang="ts">
  import { TabsContent as TabsContentPrimitive } from "reka-ui";
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  interface TabsContentProps {
    value: string;
  }

  const props = defineProps<TabsContentProps>();

  const className = computed(() =>
    cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    )
  );
</script>

<template>
  <TabsContentPrimitive :value="props.value" :class="className"> <slot /> </TabsContentPrimitive>
</template>
