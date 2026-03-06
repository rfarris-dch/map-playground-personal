<script setup lang="ts">
  defineProps<{
    sectionTitle: string;
    title: string;
    description: string;
  }>();
</script>

<template>
  <header class="mb-9 space-y-2">
    <p class="font-display text-sm font-medium text-sky-500">{{ sectionTitle }}</p>
    <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">{{ title }}</h1>
    <p class="max-w-3xl text-base text-slate-600 dark:text-slate-400">{{ description }}</p>
  </header>
</template>
