<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("flex flex-col space-y-1.5 p-6"));
</script>

<template>
  <header :class="className"><slot /></header>
</template>
