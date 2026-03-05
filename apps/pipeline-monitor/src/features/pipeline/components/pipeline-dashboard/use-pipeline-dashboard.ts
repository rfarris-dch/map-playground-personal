import { computed } from "vue";
import type { PipelineDashboardModel } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
import {
  parseBuildProgress,
  parseDbLoadProgress,
  parseIsoTimestamp,
  stringifyUnknown,
} from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-parse.service";
import {
  computeStateCompletionPercent,
  deriveRunProgress,
  isStateCompleted,
  normalizeExpectedForDisplay,
} from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-progress.service";
import { formatPercent } from "@/features/pipeline/pipeline.service";
import { usePipelineStatus } from "@/features/pipeline/pipeline.view";
import { estimateTileBuildRate } from "@/features/pipeline/pipeline-tracking/pipeline-tracking-build-rate.service";
import { estimatePipelineRate } from "@/features/pipeline/pipeline-tracking/pipeline-tracking-rate.service";

export function usePipelineDashboard(): PipelineDashboardModel {
  const pipelineStatus = usePipelineStatus();

  const response = computed(() => pipelineStatus.payload.value?.response ?? null);
  const run = computed(() => response.value?.run ?? null);
  const runProgress = computed(() => {
    const currentRun = run.value;
    if (typeof currentRun !== "object" || currentRun === null) {
      return null;
    }

    return Reflect.get(currentRun, "progress");
  });
  const isRunning = computed(() => run.value?.isRunning === true);

  const rateEstimate = computed(() => estimatePipelineRate(pipelineStatus.history.value));
  const buildRateEstimate = computed(() => estimateTileBuildRate(pipelineStatus.history.value));

  const normalizedRunProgress = computed(() => deriveRunProgress(run.value));
  const displayedStatesCompleted = computed(
    () => normalizedRunProgress.value?.statesCompleted ?? 0
  );
  const displayedStatesTotal = computed(() => normalizedRunProgress.value?.statesTotal ?? 0);
  const displayedWrittenCount = computed(() => normalizedRunProgress.value?.writtenCount ?? 0);
  const displayedExpectedCount = computed(() => normalizedRunProgress.value?.expectedCount ?? null);

  const stateProgressPercent = computed(() => {
    const progress = normalizedRunProgress.value;
    if (progress === null) {
      return 0;
    }

    return formatPercent(progress.statesCompleted, progress.statesTotal);
  });

  const rowProgressPercent = computed(() => {
    const progress = normalizedRunProgress.value;
    if (progress === null || progress.expectedCount === null) {
      return 0;
    }

    return formatPercent(progress.writtenCount, progress.expectedCount);
  });

  const sortedStates = computed(() => {
    if (run.value === null) {
      return [];
    }

    return [...run.value.states].sort((left, right) => left.state.localeCompare(right.state));
  });

  const stateRows = computed(() => {
    return sortedStates.value.map((stateRow) => {
      const updatedAtMs = parseIsoTimestamp(stateRow.updatedAt);
      const updatedAgeMs =
        updatedAtMs === null ? null : Math.max(0, pipelineStatus.clockNowMs.value - updatedAtMs);
      const expectedForDisplay = normalizeExpectedForDisplay(
        stateRow.expectedCount,
        stateRow.writtenCount,
        isStateCompleted(stateRow)
      );
      const remainingRows =
        expectedForDisplay === null
          ? null
          : Math.max(0, expectedForDisplay - stateRow.writtenCount);
      const completionPercent = computeStateCompletionPercent({
        expectedForDisplay,
        isCompleted: isStateCompleted(stateRow),
        isRunning: isRunning.value,
        pollingIntervalMs: pipelineStatus.pollingIntervalMs.value,
        updatedAgeMs,
        writtenCount: stateRow.writtenCount,
      });

      return {
        ...stateRow,
        completionPercent,
        expectedForDisplay,
        remainingRows,
        updatedAgeMs,
      };
    });
  });

  const activeStateWindowMs = computed(() =>
    Math.max(pipelineStatus.pollingIntervalMs.value * 5, 30_000)
  );
  const activeMovingStateCodes = computed(() => {
    return stateRows.value
      .filter((stateRow) => {
        if (stateRow.updatedAgeMs === null) {
          return false;
        }

        if (stateRow.updatedAgeMs > activeStateWindowMs.value) {
          return false;
        }

        if (isStateCompleted(stateRow)) {
          return false;
        }

        if (stateRow.expectedForDisplay === 0) {
          return false;
        }

        if (stateRow.pagesFetched === 0 && stateRow.writtenCount === 0) {
          return false;
        }

        return true;
      })
      .map((stateRow) => stateRow.state);
  });

  const logTailLines = computed(() => run.value?.logTail ?? []);
  const eventFeedRows = computed(() => [...pipelineStatus.events.value].reverse());

  const responseAgeMs = computed(() => {
    const generatedAtMs = parseIsoTimestamp(response.value?.generatedAt);
    if (generatedAtMs === null) {
      return null;
    }

    return Math.max(0, pipelineStatus.clockNowMs.value - generatedAtMs);
  });

  const lastSuccessAgeMs = computed(() => {
    const successAtMs = parseIsoTimestamp(pipelineStatus.lastSuccessfulRefreshAt.value);
    if (successAtMs === null) {
      return null;
    }

    return Math.max(0, pipelineStatus.clockNowMs.value - successAtMs);
  });

  const nextPollInMs = computed(() => {
    if (!pipelineStatus.autoRefresh.value) {
      return null;
    }

    const nextPollAtMs = parseIsoTimestamp(pipelineStatus.nextPollAt.value);
    if (nextPollAtMs === null) {
      return null;
    }

    return Math.max(0, nextPollAtMs - pipelineStatus.clockNowMs.value);
  });

  const successRatePercent = computed(() => {
    return formatPercent(
      pipelineStatus.successfulRequests.value,
      pipelineStatus.totalRequests.value
    );
  });

  const dbLoadProgress = computed(() =>
    parseDbLoadProgress(run.value?.summary ?? null, runProgress.value)
  );
  const isMaterializeFinalizing = computed(() => {
    if (run.value?.phase !== "loading" || !isRunning.value) {
      return false;
    }

    if (dbLoadProgress.value?.stepKey !== "materialize") {
      return false;
    }

    return (dbLoadProgress.value.percent ?? 0) >= 99;
  });

  const dbLoadPercentLabel = computed(() => {
    const percent = dbLoadProgress.value?.percent;
    if (percent === null) {
      return "n/a";
    }

    const percentText = `${String(percent)}%`;
    if (isMaterializeFinalizing.value) {
      return `${percentText} (finalizing)`;
    }

    return percentText;
  });

  const dbLoadDetailLabel = computed(() => {
    const stepKey = dbLoadProgress.value?.stepKey;
    if (stepKey === "staging") {
      return "Current file";
    }

    if (stepKey === "materialize") {
      return "Metrics";
    }

    return "Detail";
  });

  const buildProgress = computed(() =>
    parseBuildProgress(run.value?.summary ?? null, runProgress.value)
  );
  const buildProgressPercent = computed(() => {
    const percent = buildProgress.value?.percent;
    if (typeof percent !== "number" || !Number.isFinite(percent)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(percent)));
  });

  const isLikelyStalled = computed(() => {
    const stalledMs = rateEstimate.value.stalledMs;
    if (!isRunning.value || stalledMs === null) {
      return false;
    }

    const thresholdMs = Math.max(pipelineStatus.pollingIntervalMs.value * 4, 60_000);
    return stalledMs >= thresholdMs;
  });

  const isBuildLikelyStalled = computed(() => {
    const stalledMs = buildRateEstimate.value.stalledMs;
    if (!isRunning.value || run.value?.phase !== "building" || stalledMs === null) {
      return false;
    }

    const thresholdMs = Math.max(pipelineStatus.pollingIntervalMs.value * 8, 300_000);
    return stalledMs >= thresholdMs;
  });

  const liveStatusLabel = computed(() => {
    if (pipelineStatus.isLoading.value && pipelineStatus.lastSuccessfulRefreshAt.value === null) {
      return "Connecting";
    }

    if (pipelineStatus.consecutiveFailures.value > 0) {
      return "Degraded";
    }

    const ageMs = responseAgeMs.value;
    if (ageMs !== null && ageMs > Math.max(pipelineStatus.pollingIntervalMs.value * 2, 30_000)) {
      return "Stale";
    }

    return "Live";
  });

  const liveStatusTone = computed(() => {
    if (liveStatusLabel.value === "Live") {
      return "bg-emerald-100 text-emerald-800";
    }

    if (liveStatusLabel.value === "Connecting") {
      return "bg-sky-100 text-sky-800";
    }

    if (liveStatusLabel.value === "Stale") {
      return "bg-amber-100 text-amber-800";
    }

    return "bg-red-100 text-red-800";
  });

  const phaseTone = computed(() => {
    const phase = run.value?.phase;
    if (phase === "failed") {
      return "bg-red-100 text-red-800";
    }

    if (phase === "completed") {
      return "bg-emerald-100 text-emerald-800";
    }

    if (isRunning.value) {
      return "bg-amber-100 text-amber-800";
    }

    return "bg-muted text-muted-foreground";
  });

  const errorDetails = computed(() => stringifyUnknown(pipelineStatus.error.value?.details));

  const partialStateWarning = computed(() => {
    const currentRun = run.value;
    if (currentRun === null) {
      return null;
    }

    if (currentRun.states.length <= 1 && !currentRun.isRunning) {
      return "This run only exposes a partial checkpoint set (likely a smoke/single-state run). Full-state visibility appears only during a full sync run.";
    }

    return null;
  });

  const noActiveSyncWarning = computed(() => {
    const currentResponse = response.value;
    const currentRun = run.value;
    if (currentResponse === null || currentRun === null) {
      return null;
    }

    if (currentRun.isRunning) {
      return null;
    }

    if (!currentResponse.enabled) {
      return "No active parcels sync is running (AUTO_PARCELS_SYNC=false). Status values stay static until a new run starts.";
    }

    const generatedAtMs = parseIsoTimestamp(currentResponse.generatedAt);
    const completedAtMs = parseIsoTimestamp(currentResponse.latestRunCompletedAt);
    if (generatedAtMs !== null && completedAtMs !== null) {
      const sinceLastCompletionMs = Math.max(0, generatedAtMs - completedAtMs);
      if (sinceLastCompletionMs > Math.max(currentResponse.intervalMs, 60_000)) {
        return "No active sync run detected. Last completion is older than the configured interval, so metrics are stale.";
      }
    }

    return null;
  });

  async function onRefreshNow(): Promise<void> {
    await pipelineStatus.refreshNow();
  }

  function onToggleAutoRefresh(nextChecked: boolean): void {
    pipelineStatus.setAutoRefresh(nextChecked);
  }

  return {
    pipelineStatus,
    response,
    run,
    isRunning,
    rateEstimate,
    buildRateEstimate,
    stateRows,
    stateProgressPercent,
    rowProgressPercent,
    activeMovingStateCodes,
    logTailLines,
    eventFeedRows,
    responseAgeMs,
    lastSuccessAgeMs,
    nextPollInMs,
    successRatePercent,
    displayedStatesCompleted,
    displayedStatesTotal,
    displayedWrittenCount,
    displayedExpectedCount,
    dbLoadProgress,
    dbLoadPercentLabel,
    dbLoadDetailLabel,
    isMaterializeFinalizing,
    buildProgress,
    buildProgressPercent,
    isLikelyStalled,
    isBuildLikelyStalled,
    liveStatusLabel,
    liveStatusTone,
    phaseTone,
    errorDetails,
    partialStateWarning,
    noActiveSyncWarning,
    onRefreshNow,
    onToggleAutoRefresh,
  };
}
