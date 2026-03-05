<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const tableClassName = computed(() => cn("w-full caption-bottom text-sm"));
</script>

<template>
  <div class="relative w-full overflow-auto">
    <table :class="tableClassName">
      <slot />
    </table>
  </div>
</template>
