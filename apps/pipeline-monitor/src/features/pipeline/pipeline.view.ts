import { computed, onBeforeUnmount, onMounted, type Ref, ref } from "vue";
import { fetchPipelineStatus } from "./pipeline.service";
import type {
  PipelineFetchFailure,
  PipelineLiveEvent,
  PipelineLiveSample,
  PipelineStatusController,
  PipelineStatusPayload,
} from "./pipeline.types";
import {
  appendPipelineLiveEvents,
  appendPipelineLiveSample,
  buildPipelineFetchErrorEvent,
  buildPipelineLiveEvents,
  buildPipelineLiveSample,
} from "./pipeline-tracking.service";

const RUNNING_REFRESH_INTERVAL_MS = 3000;
const IDLE_REFRESH_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 1000;

function nextRefreshInterval(payload: PipelineStatusPayload | null): number {
  if (payload === null) {
    return RUNNING_REFRESH_INTERVAL_MS;
  }

  if (payload.response.run.isRunning) {
    return RUNNING_REFRESH_INTERVAL_MS;
  }

  return IDLE_REFRESH_INTERVAL_MS;
}

interface MutablePollingState {
  abortController: AbortController | null;
  destroyed: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  refreshGeneration: number;
  timer: ReturnType<typeof setTimeout> | null;
}

function clearPendingTimer(state: MutablePollingState, nextPollAt: Ref<string | null>): void {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  nextPollAt.value = null;
}

function startHeartbeat(state: MutablePollingState, clockNowMs: Ref<number>): void {
  if (state.heartbeatTimer !== null) {
    return;
  }

  state.heartbeatTimer = setInterval(() => {
    clockNowMs.value = Date.now();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(state: MutablePollingState): void {
  if (state.heartbeatTimer !== null) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

function scheduleNextPoll(
  state: MutablePollingState,
  autoRefresh: Ref<boolean>,
  delayMs: number,
  nextPollAt: Ref<string | null>,
  callback: () => Promise<void>
): void {
  clearPendingTimer(state, nextPollAt);
  if (!autoRefresh.value) {
    return;
  }

  nextPollAt.value = new Date(Date.now() + delayMs).toISOString();
  state.timer = setTimeout(() => {
    state.timer = null;
    nextPollAt.value = null;
    callback().catch((error) => {
      console.error("[pipeline-monitor] scheduled refresh failed", error);
    });
  }, delayMs);
}

export function usePipelineStatus(): PipelineStatusController {
  const payload = ref<PipelineStatusPayload | null>(null);
  const error = ref<PipelineFetchFailure | null>(null);
  const isLoading = ref<boolean>(true);
  const autoRefresh = ref<boolean>(true);
  const clockNowMs = ref<number>(Date.now());
  const history = ref<readonly PipelineLiveSample[]>([]);
  const events = ref<readonly PipelineLiveEvent[]>([]);
  const totalRequests = ref<number>(0);
  const successfulRequests = ref<number>(0);
  const consecutiveFailures = ref<number>(0);
  const lastFetchStartedAt = ref<string | null>(null);
  const lastFetchCompletedAt = ref<string | null>(null);
  const lastSuccessfulRefreshAt = ref<string | null>(null);
  const lastFailedRefreshAt = ref<string | null>(null);
  const lastRequestDurationMs = ref<number | null>(null);
  const nextPollAt = ref<string | null>(null);
  const pollingIntervalMs = computed(() => nextRefreshInterval(payload.value));

  const pollingState: MutablePollingState = {
    abortController: null,
    refreshGeneration: 0,
    timer: null,
    destroyed: false,
    heartbeatTimer: null,
  };

  async function refreshNow(): Promise<void> {
    if (pollingState.destroyed) {
      return;
    }

    pollingState.refreshGeneration += 1;
    const activeGeneration = pollingState.refreshGeneration;

    if (pollingState.abortController !== null) {
      pollingState.abortController.abort();
      pollingState.abortController = null;
    }

    const abortController = new AbortController();
    pollingState.abortController = abortController;
    const startedAtMs = Date.now();
    lastFetchStartedAt.value = new Date(startedAtMs).toISOString();
    totalRequests.value += 1;
    if (payload.value === null) {
      isLoading.value = true;
    }

    const result = await fetchPipelineStatus(abortController.signal);
    if (pollingState.destroyed || activeGeneration !== pollingState.refreshGeneration) {
      return;
    }

    const completedAtMs = Date.now();
    const completedAt = new Date(completedAtMs).toISOString();
    lastFetchCompletedAt.value = completedAt;
    lastRequestDurationMs.value = completedAtMs - startedAtMs;

    if (result.ok) {
      const previousConsecutiveFailures = consecutiveFailures.value;
      payload.value = result.payload;
      error.value = null;
      successfulRequests.value += 1;
      consecutiveFailures.value = 0;
      lastSuccessfulRefreshAt.value = completedAt;

      const nextSample = buildPipelineLiveSample(result.payload, completedAt);
      const previousSample = history.value.at(-1) ?? null;
      history.value = appendPipelineLiveSample(history.value, nextSample);

      const builtEvents = buildPipelineLiveEvents(previousSample, nextSample);
      events.value = appendPipelineLiveEvents(events.value, builtEvents);

      if (previousConsecutiveFailures > 0) {
        events.value = appendPipelineLiveEvents(events.value, [
          {
            capturedAt: completedAt,
            requestId: result.payload.requestId,
            tone: "success",
            message: `Recovered after ${String(previousConsecutiveFailures)} failed poll(s)`,
          },
        ]);
      }
    } else if (result.error.reason !== "aborted") {
      error.value = result.error;
      consecutiveFailures.value += 1;
      lastFailedRefreshAt.value = completedAt;
      events.value = appendPipelineLiveEvents(events.value, [
        buildPipelineFetchErrorEvent(result.error, completedAt),
      ]);
    }

    isLoading.value = false;
    if (pollingState.abortController === abortController) {
      pollingState.abortController = null;
    }
    scheduleNextPoll(pollingState, autoRefresh, pollingIntervalMs.value, nextPollAt, refreshNow);
  }

  function setAutoRefresh(nextValue: boolean): void {
    autoRefresh.value = nextValue;
    if (!nextValue) {
      clearPendingTimer(pollingState, nextPollAt);
      return;
    }

    scheduleNextPoll(pollingState, autoRefresh, pollingIntervalMs.value, nextPollAt, refreshNow);
  }

  onMounted(() => {
    startHeartbeat(pollingState, clockNowMs);
    refreshNow().catch((refreshError) => {
      error.value = {
        reason: "network",
        requestId: "pipeline-ui-internal",
        message: "Initial refresh failed",
        details: refreshError,
      };
      const capturedAt = new Date().toISOString();
      events.value = appendPipelineLiveEvents(events.value, [
        {
          capturedAt,
          requestId: "pipeline-ui-internal",
          tone: "critical",
          message: "Initial refresh failed",
        },
      ]);
      isLoading.value = false;
    });
  });

  onBeforeUnmount(() => {
    pollingState.destroyed = true;
    clearPendingTimer(pollingState, nextPollAt);
    stopHeartbeat(pollingState);
    if (pollingState.abortController !== null) {
      pollingState.abortController.abort();
      pollingState.abortController = null;
    }
  });

  return {
    autoRefresh,
    clockNowMs,
    consecutiveFailures,
    error,
    events,
    history,
    isLoading,
    lastFailedRefreshAt,
    lastFetchCompletedAt,
    lastFetchStartedAt,
    lastRequestDurationMs,
    lastSuccessfulRefreshAt,
    nextPollAt,
    payload,
    pollingIntervalMs,
    successfulRequests,
    totalRequests,
    refreshNow,
    setAutoRefresh,
  };
}
