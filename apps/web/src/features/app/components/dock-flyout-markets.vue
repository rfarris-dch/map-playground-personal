<script setup lang="ts">
  import type { MarketBoundaryColorMode } from "@/features/market-boundaries/market-boundaries.types";

  interface DockFlyoutMarketsProps {
    readonly colorMode: MarketBoundaryColorMode;
  }

  interface DockFlyoutMarketsEmits {
    "update:color-mode": [mode: MarketBoundaryColorMode];
  }

  const props = defineProps<DockFlyoutMarketsProps>();
  const emit = defineEmits<DockFlyoutMarketsEmits>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <span
      data-flyout-section
      class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50"
      >Color By</span
    >
    <select
      :value="props.colorMode"
      class="h-7 w-full rounded-md border border-border bg-transparent px-2 text-xs text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      @change="emit('update:color-mode', ($event.target as HTMLSelectElement).value as MarketBoundaryColorMode)"
    >
      <option value="power">Commissioned Power</option>
      <option value="vacancy">Vacancy Rate</option>
      <option value="absorption">Absorption</option>
    </select>
  </div>
</template>
