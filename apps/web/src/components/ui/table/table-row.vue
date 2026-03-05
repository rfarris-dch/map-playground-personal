<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() =>
    cn("border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted")
  );
</script>

<template>
  <tr :class="className">
    <slot />
  </tr>
</template>
