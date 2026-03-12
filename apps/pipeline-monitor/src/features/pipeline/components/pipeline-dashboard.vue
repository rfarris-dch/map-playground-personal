<script setup lang="ts">
  import { computed } from "vue";
  import PipelineDashboardAlerts from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-alerts.vue";
  import PipelineDashboardDetailsPanels from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-details-panels.vue";
  import PipelineDashboardFetchErrorAlert from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-fetch-error-alert.vue";
  import PipelineDashboardLogTail from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-log-tail.vue";
  import PipelineDashboardOverview from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-overview.vue";
  import PipelineDashboardProgressPanels from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-progress-panels.vue";
  import PipelineDashboardStateEvents from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-state-events.vue";
  import { usePipelineDashboard } from "@/features/pipeline/components/pipeline-dashboard/use-pipeline-dashboard";
  import type { PipelineDataset } from "@/features/pipeline/pipeline.types";

  const props = defineProps<{
    dataset: PipelineDataset;
  }>();

  const {
    dataset: selectedDataset,
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
    stageSizeLabel,
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
  } = usePipelineDashboard(props.dataset);

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
      :build-progress="buildProgress"
      :build-rate-estimate="buildRateEstimate"
      :db-load-percent-label="dbLoadPercentLabel"
      :db-load-progress="dbLoadProgress"
      :dataset="selectedDataset"
      :is-build-likely-stalled="isBuildLikelyStalled"
      :is-likely-stalled="isLikelyStalled"
      :is-running="isRunning"
      :is-materialize-finalizing="isMaterializeFinalizing"
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
      :stage-size-label="stageSizeLabel"
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
      :dataset="selectedDataset"
      :db-load-detail-label="dbLoadDetailLabel"
      :db-load-percent-label="dbLoadPercentLabel"
      :db-load-progress="dbLoadProgress"
      :displayed-expected-count="displayedExpectedCount"
      :displayed-states-completed="displayedStatesCompleted"
      :displayed-states-total="displayedStatesTotal"
      :displayed-written-count="displayedWrittenCount"
      :is-build-likely-stalled="isBuildLikelyStalled"
      :is-flood-loading="selectedDataset === 'flood' && run?.phase === 'loading'"
      :is-materialize-finalizing="isMaterializeFinalizing"
      :row-progress-percent="rowProgressPercent"
      :run="run"
      :stage-size-label="stageSizeLabel"
      :state-progress-percent="stateProgressPercent"
    />

    <PipelineDashboardAlerts
      :dataset="selectedDataset"
      :partial-state-warning="partialStateWarning"
      :no-active-sync-warning="noActiveSyncWarning"
    />

    <PipelineDashboardDetailsPanels :response="response" :run="run" />

    <PipelineDashboardStateEvents
      :dataset="selectedDataset"
      :event-feed-rows="eventFeedRows"
      :stage-size-label="stageSizeLabel"
      :state-rows="stateRows"
    />

    <PipelineDashboardLogTail :log-tail-lines="logTailLines" />
  </section>
</template>
