<script setup lang="ts">
  import type { PipelineDashboardFetchErrorAlertProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";

  const props = defineProps<PipelineDashboardFetchErrorAlertProps>();
</script>

<template>
  <div v-if="props.error !== null" class="rounded-xl border border-red-300 bg-red-50 p-3 shadow-sm">
    <p class="m-0 text-sm font-semibold text-red-700">Failed to fetch status</p>
    <p class="mt-1 break-words text-xs font-mono text-red-700">{{ props.error.message }}</p>
    <p class="mt-1 break-words text-xs font-mono text-red-700/90">
      requestId={{ props.error.requestId }}
    </p>
    <pre
      v-if="props.errorDetails !== null"
      class="mt-2 max-h-48 overflow-auto rounded border border-red-300/70 bg-red-100/70 p-2 text-[11px] leading-5 text-red-700"
    >{{ props.errorDetails }}</pre>
  </div>
</template>
