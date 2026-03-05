<script setup lang="ts">
  import type { PipelineDashboardDetailsProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
  import { formatDurationMs, formatTimestamp } from "@/features/pipeline/pipeline.service";

  const props = defineProps<PipelineDashboardDetailsProps>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">Run Details</h2>
      </header>
      <dl class="grid grid-cols-[10rem_1fr] gap-y-1 text-xs">
        <dt class="text-muted-foreground">Reason</dt>
        <dd class="font-mono">{{ props.run?.reason ?? "n/a" }}</dd>
        <dt class="text-muted-foreground">Started At</dt>
        <dd class="font-mono">{{ formatTimestamp(props.run?.startedAt ?? null) }}</dd>
        <dt class="text-muted-foreground">Ended At</dt>
        <dd class="font-mono">{{ formatTimestamp(props.run?.endedAt ?? null) }}</dd>
        <dt class="text-muted-foreground">Duration</dt>
        <dd class="font-mono">{{ formatDurationMs(props.run?.durationMs ?? null) }}</dd>
        <dt class="text-muted-foreground">Exit Code</dt>
        <dd class="font-mono">{{ props.run?.exitCode ?? "n/a" }}</dd>
        <dt class="text-muted-foreground">Summary</dt>
        <dd class="break-words font-mono">{{ props.run?.summary ?? "n/a" }}</dd>
      </dl>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">Sync Config</h2>
      </header>
      <dl class="grid grid-cols-[10rem_1fr] gap-y-1 text-xs">
        <dt class="text-muted-foreground">Enabled</dt>
        <dd class="font-mono">{{ props.response?.enabled ? "true" : "false" }}</dd>
        <dt class="text-muted-foreground">Mode</dt>
        <dd class="font-mono">{{ props.response?.mode ?? "n/a" }}</dd>
        <dt class="text-muted-foreground">Startup Required</dt>
        <dd class="font-mono">{{ props.response?.requireStartupSuccess ? "true" : "false" }}</dd>
        <dt class="text-muted-foreground">Interval</dt>
        <dd class="font-mono">{{ formatDurationMs(props.response?.intervalMs ?? null) }}</dd>
        <dt class="text-muted-foreground">Latest Run Completed</dt>
        <dd class="font-mono">
          {{ formatTimestamp(props.response?.latestRunCompletedAt ?? null) }}
        </dd>
        <dt class="text-muted-foreground">Snapshot Root</dt>
        <dd class="break-words font-mono">{{ props.response?.snapshotRoot ?? "n/a" }}</dd>
      </dl>
    </article>
  </div>
</template>
