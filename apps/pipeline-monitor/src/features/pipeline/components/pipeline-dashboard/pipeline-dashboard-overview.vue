<script setup lang="ts">
  import { computed } from "vue";
  import type { PipelineDashboardOverviewProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
  import {
    formatBuildRate,
    formatEta,
    formatRate,
    formatRelativeDuration,
    formatRowsPerSecondValue,
  } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-format.service";
  import {
    formatCount,
    formatDurationMs,
    formatPhaseLabel,
    formatTimestamp,
  } from "@/features/pipeline/pipeline.service";
  import { getPipelineDataset } from "@/features/pipeline/pipeline-registry.service";

  const BUILD_EXPORT_ELAPSED_PATTERN = /phase=export\s+([0-9]+)s\b/;

  const props = defineProps<PipelineDashboardOverviewProps>();
  const isEnvironmentalDataset = computed(
    () => getPipelineDataset(props.dataset).family === "environmental"
  );

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

  const phaseLabel = computed(() => {
    if (props.run === null) {
      return "Idle";
    }

    if (isEnvironmentalDataset.value && props.run.phase === "extracting") {
      const extractState = props.run.states.find((stateRow) => stateRow.state === "extract");
      const normalizeState = props.run.states.find((stateRow) => stateRow.state === "normalize");

      if (extractState?.isCompleted === true && normalizeState?.isCompleted !== true) {
        return "Normalizing";
      }
    }

    return formatPhaseLabel(props.run.phase, props.dataset, props.run.summary);
  });

  const isBuilding = computed(() => props.run?.phase === "building");
  const isFloodBuildPreparingExport = computed(() => {
    if (!(isBuilding.value && isEnvironmentalDataset.value)) {
      return false;
    }

    const summary = props.run?.summary ?? "";
    return (
      summary.includes("phase=export") &&
      (props.buildProgress?.workDone ?? 0) === 0 &&
      (props.buildProgress?.logBytes ?? 0) === 0
    );
  });
  const isFloodMaterializing = computed(() => {
    return isEnvironmentalDataset.value && props.dbLoadProgress?.stepKey === "materialize";
  });
  const buildExportElapsedLabel = computed(() => {
    const summary = props.run?.summary ?? "";
    const match = BUILD_EXPORT_ELAPSED_PATTERN.exec(summary);
    if (match === null) {
      return null;
    }

    return `${match[1]}s elapsed`;
  });

  const throughputHeading = computed(() => {
    return isBuilding.value ? "Build Rate" : "Rows Per Second";
  });

  const throughputValue = computed(() => {
    if (isFloodMaterializing.value) {
      return props.dbLoadProgress?.stepLabel ?? "Materializing canonical rows";
    }

    if (isFloodBuildPreparingExport.value) {
      return "Preparing reduced overlay geometry";
    }

    if (isBuilding.value) {
      return formatBuildRate(
        props.buildRateEstimate.percentPerSecond,
        props.buildRateEstimate.rateBasis
      );
    }

    return formatRate(props.rateEstimate.rowsPerSecond, props.rateEstimate.rateBasis);
  });

  const throughputDetails = computed(() => {
    if (isFloodMaterializing.value) {
      return `Current batch: ${props.dbLoadProgress?.currentFile ?? "n/a"}`;
    }

    if (isFloodBuildPreparingExport.value) {
      return buildExportElapsedLabel.value ?? "waiting for first reduced export batch";
    }

    if (isBuilding.value) {
      if (
        props.buildProgress?.workDone !== null &&
        props.buildProgress?.workTotal === null &&
        props.run?.summary?.includes("phase=reduced-export")
      ) {
        return `exported rows: ${formatCount(props.buildProgress.workDone)}`;
      }

      return `recent: ${formatBuildRate(
        props.buildRateEstimate.recentPercentPerSecond,
        "recent"
      )} · avg: ${formatBuildRate(props.buildRateEstimate.averagePercentPerSecond, "average")}`;
    }

    return `recent: ${formatRowsPerSecondValue(props.rateEstimate.recentRowsPerSecond)} · avg: ${formatRowsPerSecondValue(props.rateEstimate.averageRowsPerSecond)}`;
  });

  const remainingHeading = computed(() => {
    return isBuilding.value ? "Build ETA" : "Remaining ETA";
  });

  const remainingValue = computed(() => {
    if (isFloodMaterializing.value) {
      return props.dbLoadPercentLabel;
    }

    if (isFloodBuildPreparingExport.value) {
      return "estimating after first reduced batch";
    }

    if (isBuilding.value) {
      return formatEta(props.buildRateEstimate.etaMs);
    }

    return formatEta(props.rateEstimate.etaMs);
  });

  const remainingDetails = computed(() => {
    if (isFloodMaterializing.value) {
      return `active worker: ${props.dbLoadProgress?.activeWorkers[0] ?? "n/a"}`;
    }

    if (isFloodBuildPreparingExport.value) {
      return "progress becomes measurable after the first reduced overlay rows are emitted";
    }

    if (isBuilding.value) {
      if (
        props.buildProgress?.workDone !== null &&
        props.buildProgress?.workTotal === null &&
        props.run?.summary?.includes("phase=reduced-export")
      ) {
        return "remaining build: estimating after reduced export completes";
      }

      const remainingPercent = props.buildRateEstimate.remainingPercent;
      if (remainingPercent === null) {
        return props.run?.summary ?? "tiles:building";
      }

      return `remaining build: ${remainingPercent.toFixed(2)}%`;
    }

    return `remaining rows: ${props.rateEstimate.remainingRows === null ? "n/a" : formatCount(props.rateEstimate.remainingRows)}`;
  });

  const lastMovementMs = computed(() => {
    if (isBuilding.value) {
      return props.buildRateEstimate.stalledMs ?? props.rateEstimate.stalledMs;
    }

    return props.rateEstimate.stalledMs;
  });
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
          {{ phaseLabel }}
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
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">
        {{ throughputHeading }}
      </p>
      <p class="mt-2 text-sm font-semibold">{{ throughputValue }}</p>
      <p class="mt-1 text-xs text-muted-foreground">{{ throughputDetails }}</p>
      <p v-if="lastMovementMs !== null" class="mt-1 text-xs text-muted-foreground">
        last movement: {{ formatRelativeDuration(lastMovementMs) }} ago
      </p>
      <p
        v-if="isEnvironmentalDataset && props.stageSizeLabel !== null && !isBuilding"
        class="mt-1 text-xs text-muted-foreground"
      >
        load metric: {{ props.stageSizeLabel }}
      </p>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm">
      <p class="m-0 text-xs uppercase tracking-wide text-muted-foreground">
        {{ remainingHeading }}
      </p>
      <p class="mt-2 text-sm font-semibold">{{ remainingValue }}</p>
      <p class="mt-1 text-xs text-muted-foreground">{{ remainingDetails }}</p>
      <p
        v-if="!(isFloodMaterializing || isBuilding) && props.isLikelyStalled"
        class="mt-1 text-xs text-amber-700"
      >
        No row movement detected recently; ETA is based on average rate.
      </p>
      <p v-else-if="isFloodBuildPreparingExport" class="mt-1 text-xs text-amber-700">
        Reduced-overlay preparation is active; row progress starts after the first export batch.
      </p>
      <p v-else-if="isBuilding && props.isBuildLikelyStalled" class="mt-1 text-xs text-amber-700">
        Build progress has not advanced recently; monitor remains live.
      </p>
      <p v-else-if="isFloodMaterializing" class="mt-1 text-xs text-amber-700">
        Finalizing canonical transaction. Row ETA is no longer meaningful.
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
