<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() =>
    cn("rounded-lg border border-border/80 bg-card text-card-foreground shadow-sm")
  );
</script>

<template>
  <section :class="className"><slot /></section>
</template>
