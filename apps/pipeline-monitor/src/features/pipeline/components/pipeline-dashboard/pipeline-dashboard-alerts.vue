<script setup lang="ts">
  import type { PipelineDashboardRunAlertsProps } from "./pipeline-dashboard.types";

  const props = defineProps<PipelineDashboardRunAlertsProps>();
</script>

<template>
  <div
    v-if="props.partialStateWarning !== null"
    class="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm"
  >
    <p class="m-0 text-sm font-semibold text-amber-800">Partial State Coverage</p>
    <p class="mt-1 text-xs text-amber-800">{{ props.partialStateWarning }}</p>
  </div>

  <div
    v-if="props.noActiveSyncWarning !== null"
    class="rounded-xl border border-red-300 bg-red-50 p-3 shadow-sm"
  >
    <p class="m-0 text-sm font-semibold text-red-800">No Active Sync Run</p>
    <p class="mt-1 text-xs text-red-800">{{ props.noActiveSyncWarning }}</p>
    <p class="mt-2 text-xs text-red-800">
      Start a full run to see live movement:
      <code class="rounded bg-red-100 px-1 py-0.5 font-mono">bun run sync:parcels</code>
    </p>
  </div>
</template>
