import { Exit } from "effect";
import { computed, ref } from "vue";
import type {
  PipelineFetchFailure,
  PipelineLiveEvent,
  PipelineLiveSample,
  PipelineStatusController,
  PipelineStatusFetchResult,
  PipelineStatusPayload,
} from "./pipeline.types";
import type {
  MutablePollingState,
  PipelineStatusControllerDeps,
  PipelineStatusControllerInstance,
} from "./pipeline.view.types";
import {
  appendPipelineLiveEvents,
  appendPipelineLiveSample,
} from "./pipeline-tracking/pipeline-tracking-history.service";
import {
  buildPipelineFetchErrorEvent,
  buildPipelineLiveEvents,
} from "./pipeline-tracking/pipeline-tracking-live-event.service";
import { buildPipelineLiveSample } from "./pipeline-tracking/pipeline-tracking-live-sample.service";

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

function clearPendingTimer(
  state: MutablePollingState,
  deps: PipelineStatusControllerDeps,
  nextPollAt: PipelineStatusController["nextPollAt"]
): void {
  if (state.timer !== null) {
    deps.clearTimeout(state.timer);
    state.timer = null;
  }
  nextPollAt.value = null;
}

function startHeartbeat(
  state: MutablePollingState,
  deps: PipelineStatusControllerDeps,
  clockNowMs: PipelineStatusController["clockNowMs"]
): void {
  if (state.heartbeatTimer !== null) {
    return;
  }

  state.heartbeatTimer = deps.setInterval(() => {
    clockNowMs.value = deps.now();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(state: MutablePollingState, deps: PipelineStatusControllerDeps): void {
  if (state.heartbeatTimer !== null) {
    deps.clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

function scheduleNextPoll(
  state: MutablePollingState,
  deps: PipelineStatusControllerDeps,
  autoRefresh: PipelineStatusController["autoRefresh"],
  delayMs: number,
  nextPollAt: PipelineStatusController["nextPollAt"],
  callback: () => Promise<void>
): void {
  clearPendingTimer(state, deps, nextPollAt);
  if (!autoRefresh.value) {
    return;
  }

  nextPollAt.value = new Date(deps.now() + delayMs).toISOString();
  state.timer = deps.setTimeout(() => {
    state.timer = null;
    nextPollAt.value = null;
    callback().catch((error) => {
      console.error("[pipeline-monitor] scheduled refresh failed", error);
    });
  }, delayMs);
}

async function interruptCurrentRefresh(
  state: MutablePollingState,
  deps: PipelineStatusControllerDeps
): Promise<void> {
  const currentRefreshFiber = state.currentRefreshFiber;
  if (currentRefreshFiber === null) {
    return;
  }

  state.currentRefreshFiber = null;
  const interrupted = await deps.runtime.interruptFiber(currentRefreshFiber);
  if (Exit.isFailure(interrupted) && !Exit.isInterrupted(interrupted)) {
    console.error("[pipeline-monitor] refresh interruption failed", interrupted.cause);
  }
}

function applyUnexpectedRefreshFailure(
  completedAt: string,
  details: unknown,
  error: PipelineStatusController["error"],
  events: PipelineStatusController["events"],
  consecutiveFailures: PipelineStatusController["consecutiveFailures"],
  lastFailedRefreshAt: PipelineStatusController["lastFailedRefreshAt"]
): void {
  const unexpectedFailure: PipelineFetchFailure = {
    reason: "network",
    requestId: "pipeline-ui-internal",
    message: "Refresh execution failed",
    details,
  };

  error.value = unexpectedFailure;
  consecutiveFailures.value += 1;
  lastFailedRefreshAt.value = completedAt;
  events.value = appendPipelineLiveEvents(events.value, [
    buildPipelineFetchErrorEvent(unexpectedFailure, completedAt),
  ]);
}

export function createPipelineStatusController(
  deps: PipelineStatusControllerDeps
): PipelineStatusControllerInstance {
  const payload = ref<PipelineStatusPayload | null>(null);
  const error = ref<PipelineFetchFailure | null>(null);
  const isLoading = ref<boolean>(true);
  const autoRefresh = ref<boolean>(true);
  const clockNowMs = ref<number>(deps.now());
  const history = ref<readonly PipelineLiveSample[]>(deps.loadPersistedHistory?.() ?? []);
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
    currentRefreshFiber: null,
    destroyed: false,
    heartbeatTimer: null,
    timer: null,
  };

  let hasStarted = false;

  function scheduleFollowingRefresh(): void {
    scheduleNextPoll(
      pollingState,
      deps,
      autoRefresh,
      pollingIntervalMs.value,
      nextPollAt,
      refreshNow
    );
  }

  function applyRefreshResult(result: PipelineStatusFetchResult, completedAt: string): void {
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
      deps.savePersistedHistory?.(history.value);

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

      return;
    }

    if (result.error.reason !== "aborted") {
      error.value = result.error;
      consecutiveFailures.value += 1;
      lastFailedRefreshAt.value = completedAt;
      events.value = appendPipelineLiveEvents(events.value, [
        buildPipelineFetchErrorEvent(result.error, completedAt),
      ]);
    }
  }

  async function refreshNow(): Promise<void> {
    if (pollingState.destroyed) {
      return;
    }

    clearPendingTimer(pollingState, deps, nextPollAt);
    await interruptCurrentRefresh(pollingState, deps);
    if (pollingState.destroyed) {
      return;
    }

    const startedAtMs = deps.now();
    lastFetchStartedAt.value = new Date(startedAtMs).toISOString();
    totalRequests.value += 1;
    if (payload.value === null) {
      isLoading.value = true;
    }

    const refreshFiber = deps.runtime.runFork(deps.fetchPipelineStatus());
    pollingState.currentRefreshFiber = refreshFiber;

    const exit = await deps.runtime.awaitFiber(refreshFiber);
    if (pollingState.destroyed || pollingState.currentRefreshFiber !== refreshFiber) {
      return;
    }

    pollingState.currentRefreshFiber = null;
    if (Exit.isInterrupted(exit)) {
      return;
    }

    const completedAtMs = deps.now();
    const completedAt = new Date(completedAtMs).toISOString();
    lastFetchCompletedAt.value = completedAt;
    lastRequestDurationMs.value = completedAtMs - startedAtMs;

    if (Exit.isFailure(exit)) {
      applyUnexpectedRefreshFailure(
        completedAt,
        exit.cause,
        error,
        events,
        consecutiveFailures,
        lastFailedRefreshAt
      );
      isLoading.value = false;
      scheduleFollowingRefresh();
      return;
    }

    applyRefreshResult(exit.value, completedAt);
    isLoading.value = false;
    scheduleFollowingRefresh();
  }

  function setAutoRefresh(nextValue: boolean): void {
    autoRefresh.value = nextValue;
    if (!nextValue) {
      clearPendingTimer(pollingState, deps, nextPollAt);
      return;
    }

    scheduleNextPoll(
      pollingState,
      deps,
      autoRefresh,
      pollingIntervalMs.value,
      nextPollAt,
      refreshNow
    );
  }

  function start(): void {
    if (hasStarted || pollingState.destroyed) {
      return;
    }

    hasStarted = true;
    startHeartbeat(pollingState, deps, clockNowMs);
    refreshNow().catch((refreshError) => {
      error.value = {
        reason: "network",
        requestId: "pipeline-ui-internal",
        message: "Initial refresh failed",
        details: refreshError,
      };
      const capturedAt = new Date(deps.now()).toISOString();
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
  }

  async function destroy(): Promise<void> {
    pollingState.destroyed = true;
    clearPendingTimer(pollingState, deps, nextPollAt);
    stopHeartbeat(pollingState, deps);
    await interruptCurrentRefresh(pollingState, deps);
  }

  return {
    controller: {
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
      refreshNow,
      setAutoRefresh,
      successfulRequests,
      totalRequests,
    },
    destroy,
    start,
  };
}
