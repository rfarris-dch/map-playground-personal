<script setup lang="ts">
  import { TabsTrigger as TabsTriggerPrimitive } from "reka-ui";
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  interface TabsTriggerProps {
    value: string;
  }

  const props = defineProps<TabsTriggerProps>();

  const className = computed(() =>
    cn(
      "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm ring-offset-background transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-card data-[state=active]:text-card-foreground data-[state=active]:shadow-sm"
    )
  );
</script>

<template>
  <TabsTriggerPrimitive :value="props.value" :class="className"> <slot /> </TabsTriggerPrimitive>
</template>
