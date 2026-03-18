<script setup lang="ts">
  import type { BoundaryHoverState } from "@/features/boundaries/boundaries.types";

  interface BoundaryHoverTooltipProps {
    readonly hoverState: BoundaryHoverState | null;
  }

  defineProps<BoundaryHoverTooltipProps>();
</script>

<template>
  <span />
</template>
