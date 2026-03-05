<script setup lang="ts">
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const className = computed(() => cn("p-4 align-middle"));
</script>

<template>
  <td :class="className"><slot /></td>
</template>
