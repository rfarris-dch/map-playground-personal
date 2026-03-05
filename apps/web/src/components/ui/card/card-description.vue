<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("text-muted-foreground text-sm"));
</script>

<template>
  <p :class="className"><slot /></p>
</template>
