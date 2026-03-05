<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("font-semibold leading-none tracking-tight"));
</script>

<template>
  <h3 :class="className"><slot /></h3>
</template>
