<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("[&_tr]:border-b"));
</script>

<template>
  <thead :class="className">
    <slot />
  </thead>
</template>
