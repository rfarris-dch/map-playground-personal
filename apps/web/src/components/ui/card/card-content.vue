<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("p-6 pt-0"));
</script>

<template>
  <div :class="className"><slot /></div>
</template>
