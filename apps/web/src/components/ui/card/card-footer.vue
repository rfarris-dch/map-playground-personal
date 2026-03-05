<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("flex items-center p-6 pt-0"));
</script>

<template>
  <footer :class="className"><slot /></footer>
</template>
