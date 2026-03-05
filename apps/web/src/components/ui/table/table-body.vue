<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("[&_tr:last-child]:border-0"));
</script>

<template>
  <tbody :class="className">
    <slot />
  </tbody>
</template>
