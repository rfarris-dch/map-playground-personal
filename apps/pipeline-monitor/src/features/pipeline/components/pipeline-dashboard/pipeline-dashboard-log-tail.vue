<script setup lang="ts">
  import type { PipelineDashboardLogTailProps } from "./pipeline-dashboard.types";

  const props = defineProps<PipelineDashboardLogTailProps>();
</script>

<template>
  <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
    <header class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-sm font-semibold">Log Tail</h2>
      <span class="text-xs text-muted-foreground">{{ props.logTailLines.length }} lines</span>
    </header>

    <ul
      class="max-h-[22rem] space-y-1 overflow-auto rounded border border-border/60 bg-background/75 p-2"
    >
      <li v-if="props.logTailLines.length === 0" class="text-xs text-muted-foreground">
        No logs captured yet.
      </li>
      <li
        v-for="(line, index) in props.logTailLines"
        :key="`${String(index)}-${line}`"
        class="break-words text-[11px] font-mono"
      >
        {{ line }}
      </li>
    </ul>
  </article>
</template>
