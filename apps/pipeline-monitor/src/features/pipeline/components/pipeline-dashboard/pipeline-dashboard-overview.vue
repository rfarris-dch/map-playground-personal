<script setup lang="ts">
  import {
    formatCount,
    formatDurationMs,
    formatPhaseLabel,
    formatTimestamp,
  } from "../../pipeline.service";
  import type { PipelineDashboardOverviewProps } from "./pipeline-dashboard.types";
  import {
    formatBuildRate,
    formatEta,
    formatRate,
    formatRelativeDuration,
    formatRowsPerSecondValue,
  } from "./pipeline-dashboard-format.service";

  const props = defineProps<PipelineDashboardOverviewProps>();

  const emit = defineEmits<{
    refreshNow: [];
    toggleAutoRefresh: [nextChecked: boolean];
  }>();

  function onToggleAutoRefresh(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("toggleAutoRefresh", target.checked);
  }
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">Feed Status</p>
      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="props.liveStatusTone">
          {{ props.liveStatusLabel }}
        </span>
        <span class="text-xs text-muted-foreground"
          >age {{ formatRelativeDuration(props.responseAgeMs) }}</span
        >
      </div>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">Phase</p>
      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="props.phaseTone">
          {{ props.run === null ? "Idle" : formatPhaseLabel(props.run.phase) }}
        </span>
        <span class="text-xs text-muted-foreground">
          {{ props.isRunning ? "running" : "not running" }}
        </span>
      </div>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">Run ID</p>
      <p class="mt-2 break-all text-xs font-mono">
        {{ props.run?.runId ?? props.response?.latestRunId ?? "n/a" }}
      </p>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">Rows Per Second</p>
      <p class="mt-2 text-sm font-semibold">
        {{ formatRate(props.rateEstimate.rowsPerSecond, props.rateEstimate.rateBasis) }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        recent: {{ formatRowsPerSecondValue(props.rateEstimate.recentRowsPerSecond) }} · avg:
        {{ formatRowsPerSecondValue(props.rateEstimate.averageRowsPerSecond) }}
      </p>
      <p v-if="props.rateEstimate.stalledMs !== null" class="mt-1 text-xs text-muted-foreground">
        last movement: {{ formatRelativeDuration(props.rateEstimate.stalledMs) }} ago
      </p>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">Remaining ETA</p>
      <p class="mt-2 text-sm font-semibold">{{ formatEta(props.rateEstimate.etaMs) }}</p>
      <p class="mt-1 text-xs text-muted-foreground">
        remaining rows:
        {{ props.rateEstimate.remainingRows === null ? "n/a" : formatCount(props.rateEstimate.remainingRows) }}
      </p>
      <p
        v-if="props.isLikelyStalled && props.run?.phase !== 'building'"
        class="mt-1 text-xs text-amber-700"
      >
        No row movement detected recently; ETA is based on average rate.
      </p>
      <p
        v-else-if="props.isLikelyStalled && props.run?.phase === 'building'"
        class="mt-1 text-xs text-amber-700"
      >
        Build progress has not advanced recently; monitor remains live.
      </p>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">Last Successful Poll</p>
      <p class="mt-2 text-xs font-mono">{{ formatTimestamp(props.lastSuccessfulRefreshAt) }}</p>
      <p class="mt-1 text-xs text-muted-foreground">
        age {{ formatRelativeDuration(props.lastSuccessAgeMs) }}
      </p>
    </article>
  </div>

  <div
    class="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm"
  >
    <button
      type="button"
      class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      @click="emit('refreshNow')"
    >
      Refresh now
    </button>

    <label class="flex items-center gap-2 text-xs">
      <input
        class="h-4 w-4"
        type="checkbox"
        :checked="props.sharedStatus.autoRefresh"
        @change="onToggleAutoRefresh"
      >
      Auto refresh
    </label>

    <p class="m-0 text-xs text-muted-foreground">
      Poll interval: {{ formatDurationMs(props.sharedStatus.pollingIntervalMs) }}
    </p>

    <p class="m-0 text-xs text-muted-foreground">
      Next poll in: {{ formatRelativeDuration(props.nextPollInMs) }}
    </p>

    <p class="m-0 text-xs text-muted-foreground">
      Last request latency: {{ formatDurationMs(props.sharedStatus.lastRequestDurationMs) }}
    </p>

    <p class="m-0 text-xs text-muted-foreground">
      Requests:
      {{ formatCount(props.sharedStatus.successfulRequests) }}/{{ formatCount(props.sharedStatus.totalRequests) }}
      ({{ props.successRatePercent }}%)
    </p>

    <p class="m-0 text-xs text-muted-foreground">
      Failure streak: {{ formatCount(props.sharedStatus.consecutiveFailures) }}
    </p>

    <p v-if="props.sharedStatus.isLoading" class="m-0 text-xs text-muted-foreground">Loading…</p>
  </div>
</template>
