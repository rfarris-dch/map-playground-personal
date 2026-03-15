<script setup lang="ts">
  defineProps<{
    readonly title: string;
    readonly description?: string;
  }>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center"
  >
    <h3 class="text-lg font-semibold text-muted-foreground">{{ title }}</h3>
    <p v-if="description" class="mt-2 max-w-md text-sm text-muted-foreground/80">
      {{ description }}
    </p>
  </div>
</template>
