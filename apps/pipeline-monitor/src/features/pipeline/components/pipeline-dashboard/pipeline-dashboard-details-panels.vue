<script setup lang="ts">
  import { computed } from "vue";
  import type { PipelineDashboardDetailsProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
  import {
    buildPipelineAssetChainRows,
    formatPipelineAssetLabel,
  } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-asset-chain.service";
  import { formatDurationMs, formatTimestamp } from "@/features/pipeline/pipeline.service";

  const props = defineProps<PipelineDashboardDetailsProps>();

  const assetChainRows = computed(() =>
    buildPipelineAssetChainRows(props.response?.dataset.assetChain ?? [], props.run)
  );

  function assetStatusClass(status: "completed" | "failed" | "pending" | "running"): string {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "running":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-muted text-muted-foreground";
    }
  }
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-3">
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
        <h2 class="m-0 text-sm font-semibold">Platform Stack</h2>
      </header>
      <dl class="grid grid-cols-[10rem_1fr] gap-y-1 text-xs">
        <dt class="text-muted-foreground">Dataset</dt>
        <dd class="font-mono">{{ props.response?.dataset.storageDataset ?? "n/a" }}</dd>
        <dt class="text-muted-foreground">Sync Command</dt>
        <dd class="break-words font-mono">{{ props.response?.dataset.syncCommand ?? "n/a" }}</dd>
        <dt class="text-muted-foreground">Orchestration</dt>
        <dd class="font-mono">
          {{ formatPipelineAssetLabel(props.response?.platform.orchestration ?? "") || "n/a" }}
        </dd>
        <dt class="text-muted-foreground">Canonical Store</dt>
        <dd class="font-mono">
          {{ formatPipelineAssetLabel(props.response?.platform.canonicalStore ?? "") || "n/a" }}
        </dd>
        <dt class="text-muted-foreground">Tile Build</dt>
        <dd class="font-mono">
          {{ formatPipelineAssetLabel(props.response?.platform.tileBuild ?? "") || "n/a" }}
        </dd>
        <dt class="text-muted-foreground">Tile Serve</dt>
        <dd class="font-mono">
          {{ formatPipelineAssetLabel(props.response?.platform.tileServe ?? "") || "n/a" }}
        </dd>
        <dt class="text-muted-foreground">Tile Publish</dt>
        <dd class="font-mono">
          {{ formatPipelineAssetLabel(props.response?.platform.tilePublish ?? "") || "n/a" }}
        </dd>
        <dt class="text-muted-foreground">Poll Interval</dt>
        <dd class="font-mono">{{ formatDurationMs(props.response?.intervalMs ?? null) }}</dd>
        <dt class="text-muted-foreground">Latest Completed</dt>
        <dd class="font-mono">
          {{ formatTimestamp(props.response?.latestRunCompletedAt ?? null) }}
        </dd>
        <dt class="text-muted-foreground">Snapshot Root</dt>
        <dd class="break-words font-mono">{{ props.response?.snapshotRoot ?? "n/a" }}</dd>
      </dl>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">Asset Chain</h2>
        <span class="text-xs text-muted-foreground">
          {{ assetChainRows.length }}
          asset{{ assetChainRows.length === 1 ? "" : "s" }}
        </span>
      </header>
      <ul class="space-y-2">
        <li
          v-for="assetRow in assetChainRows"
          :key="assetRow.assetKey"
          class="rounded-lg border border-border/60 bg-background/75 px-3 py-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="m-0 text-xs font-semibold">{{ assetRow.label }}</p>
              <p class="m-0 break-words font-mono text-[11px] text-muted-foreground">
                {{ assetRow.assetKey }}
              </p>
            </div>
            <span
              class="rounded-full px-2 py-1 text-[11px] font-semibold"
              :class="assetStatusClass(assetRow.status)"
            >
              {{ assetRow.statusLabel }}
            </span>
          </div>
          <p class="mt-1 m-0 text-[11px] text-muted-foreground">
            Updated: {{ formatTimestamp(assetRow.updatedAt) }}
          </p>
        </li>
      </ul>
    </article>
  </div>
</template>
