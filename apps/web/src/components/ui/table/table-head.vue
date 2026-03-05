<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() =>
    cn(
      "sticky top-0 z-10 h-10 bg-card px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wide"
    )
  );
</script>

<template>
  <th :class="className"><slot /></th>
</template>
