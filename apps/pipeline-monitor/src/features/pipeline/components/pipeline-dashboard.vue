<script setup lang="ts">
  import { computed } from "vue";
  import PipelineDashboardAlerts from "./pipeline-dashboard/pipeline-dashboard-alerts.vue";
  import PipelineDashboardDetailsPanels from "./pipeline-dashboard/pipeline-dashboard-details-panels.vue";
  import PipelineDashboardFetchErrorAlert from "./pipeline-dashboard/pipeline-dashboard-fetch-error-alert.vue";
  import PipelineDashboardLogTail from "./pipeline-dashboard/pipeline-dashboard-log-tail.vue";
  import PipelineDashboardOverview from "./pipeline-dashboard/pipeline-dashboard-overview.vue";
  import PipelineDashboardProgressPanels from "./pipeline-dashboard/pipeline-dashboard-progress-panels.vue";
  import PipelineDashboardStateEvents from "./pipeline-dashboard/pipeline-dashboard-state-events.vue";
  import { usePipelineDashboard } from "./pipeline-dashboard/use-pipeline-dashboard";

  const {
    pipelineStatus,
    response,
    run,
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
    isRunning,
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
  } = usePipelineDashboard();

  const sharedStatus = computed(() => ({
    isLoading: pipelineStatus.isLoading.value,
    pollingIntervalMs: pipelineStatus.pollingIntervalMs.value,
    autoRefresh: pipelineStatus.autoRefresh.value,
    lastRequestDurationMs: pipelineStatus.lastRequestDurationMs.value,
    successfulRequests: pipelineStatus.successfulRequests.value,
    totalRequests: pipelineStatus.totalRequests.value,
    consecutiveFailures: pipelineStatus.consecutiveFailures.value,
  }));
</script>

<template>
  <section class="flex flex-col gap-4">
    <PipelineDashboardOverview
      :is-likely-stalled="isLikelyStalled"
      :is-running="isRunning"
      :last-success-age-ms="lastSuccessAgeMs"
      :last-successful-refresh-at="pipelineStatus.lastSuccessfulRefreshAt.value"
      :live-status-label="liveStatusLabel"
      :live-status-tone="liveStatusTone"
      :next-poll-in-ms="nextPollInMs"
      :phase-tone="phaseTone"
      :rate-estimate="rateEstimate"
      :response="response"
      :response-age-ms="responseAgeMs"
      :run="run"
      :shared-status="sharedStatus"
      :success-rate-percent="successRatePercent"
      @refresh-now="onRefreshNow"
      @toggle-auto-refresh="onToggleAutoRefresh"
    />

    <PipelineDashboardFetchErrorAlert
      :error="pipelineStatus.error.value"
      :error-details="errorDetails"
    />

    <PipelineDashboardProgressPanels
      :active-moving-state-codes="activeMovingStateCodes"
      :build-progress="buildProgress"
      :build-progress-percent="buildProgressPercent"
      :build-rate-estimate="buildRateEstimate"
      :db-load-detail-label="dbLoadDetailLabel"
      :db-load-percent-label="dbLoadPercentLabel"
      :db-load-progress="dbLoadProgress"
      :displayed-expected-count="displayedExpectedCount"
      :displayed-states-completed="displayedStatesCompleted"
      :displayed-states-total="displayedStatesTotal"
      :displayed-written-count="displayedWrittenCount"
      :is-build-likely-stalled="isBuildLikelyStalled"
      :is-materialize-finalizing="isMaterializeFinalizing"
      :row-progress-percent="rowProgressPercent"
      :run="run"
      :state-progress-percent="stateProgressPercent"
    />

    <PipelineDashboardAlerts
      :partial-state-warning="partialStateWarning"
      :no-active-sync-warning="noActiveSyncWarning"
    />

    <PipelineDashboardDetailsPanels :response="response" :run="run" />

    <PipelineDashboardStateEvents :event-feed-rows="eventFeedRows" :state-rows="stateRows" />

    <PipelineDashboardLogTail :log-tail-lines="logTailLines" />
  </section>
</template>
