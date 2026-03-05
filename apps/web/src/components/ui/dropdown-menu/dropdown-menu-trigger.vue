<script setup lang="ts">
  import { DropdownMenuTrigger as DropdownMenuTriggerPrimitive } from "reka-ui";

  interface DropdownMenuTriggerProps {
    readonly asChild?: boolean;
  }

  const props = withDefaults(defineProps<DropdownMenuTriggerProps>(), {
    asChild: false,
  });
</script>

<template>
  <DropdownMenuTriggerPrimitive :as-child="props.asChild"> <slot /> </DropdownMenuTriggerPrimitive>
</template>
