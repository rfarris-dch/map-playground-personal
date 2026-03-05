<script setup lang="ts">
  import { TabsList as TabsListPrimitive } from "reka-ui";
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() =>
    cn(
      "inline-flex h-10 w-full items-center justify-start rounded-md bg-muted p-1 text-muted-foreground"
    )
  );
</script>

<template>
  <TabsListPrimitive :class="className"> <slot /> </TabsListPrimitive>
</template>
