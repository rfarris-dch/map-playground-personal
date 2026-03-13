<script setup lang="ts">
  defineProps<{
    label: string;
    value: string | number;
  }>();
</script>

<template>
  <div class="map-glass-surface rounded-md px-3 py-2">
    <p class="text-xs uppercase tracking-wide text-muted-foreground">{{ label }}</p>
    <p class="mt-0.5 text-sm font-medium tabular-nums text-foreground">{{ value }}</p>
  </div>
</template>
