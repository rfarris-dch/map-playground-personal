import type {
  ParcelsSyncConfig,
  ParcelsSyncRunReason,
  ParcelsSyncRunStatus,
  ParcelsSyncStatusSnapshot,
} from "../parcels-sync.types";
import type {
  MutableParcelsSyncRunStatus,
  MutableParcelsSyncStateProgress,
  MutableParcelsSyncStatusSnapshot,
} from "./parcels-sync-runtime.types";
import {
  detectActiveExternalRun,
  readActiveRunMarker,
  readLatestPointer,
  readRunSummary,
  readStateCheckpoints,
} from "./snapshot-read.service";
import {
  formatTileBuildSummary,
  readTileBuildProgressSnapshot,
} from "./tile-build-progress.service";

const LOG_TAIL_LIMIT = 120;
const ACTIVE_RUN_HEARTBEAT_STALE_MS = 120 * 1000;
const EXIT_CODE_SUMMARY_RE = /(?:^|\s)exit_code=([0-9]+)/;

function compareStateProgress(
  left: MutableParcelsSyncStateProgress,
  right: MutableParcelsSyncStateProgress
): number {
  return left.state.localeCompare(right.state);
}

function isActiveRunHeartbeatStale(updatedAt: string | null): boolean {
  if (updatedAt === null) {
    return true;
  }

  const parsedTimestamp = Date.parse(updatedAt);
  if (!Number.isFinite(parsedTimestamp)) {
    return true;
  }

  return Date.now() - parsedTimestamp > ACTIVE_RUN_HEARTBEAT_STALE_MS;
}

function parseExitCodeFromSummary(summary: string | null): number | null {
  if (summary === null) {
    return null;
  }

  const match = summary.match(EXIT_CODE_SUMMARY_RE);
  if (!match) {
    return null;
  }

  const exitCodeRaw = match[1];
  if (typeof exitCodeRaw !== "string") {
    return null;
  }

  const exitCode = Number.parseInt(exitCodeRaw, 10);
  if (!Number.isFinite(exitCode) || exitCode < 0) {
    return null;
  }

  return exitCode;
}

export function createInitialRunStatus(): MutableParcelsSyncRunStatus {
  return {
    runId: null,
    reason: null,
    phase: "idle",
    isRunning: false,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    exitCode: null,
    summary: null,
    states: [],
    statesCompleted: 0,
    statesTotal: 0,
    writtenCount: 0,
    expectedCount: null,
    logTail: [],
  };
}

export function createParcelsSyncStatusStore(
  config: ParcelsSyncConfig
): MutableParcelsSyncStatusSnapshot {
  return {
    enabled: config.enabled,
    mode: config.mode,
    intervalMs: config.intervalMs,
    requireStartupSuccess: config.requireStartupSuccess,
    snapshotRoot: config.snapshotRoot,
    latestRunId: null,
    latestRunCompletedAt: null,
    run: createInitialRunStatus(),
  };
}

export function recomputeRunTotals(run: MutableParcelsSyncRunStatus): void {
  const totals = run.states.reduce(
    (accumulator, state) => {
      const totalWritten = accumulator.totalWritten + state.writtenCount;
      const totalExpected =
        typeof state.expectedCount === "number"
          ? accumulator.totalExpected + state.expectedCount
          : accumulator.totalExpected;
      const hasExpectedGap = accumulator.hasExpectedGap || state.expectedCount === null;
      const completedStates = accumulator.completedStates + (state.isCompleted ? 1 : 0);

      return {
        totalWritten,
        totalExpected,
        hasExpectedGap,
        completedStates,
      };
    },
    {
      totalWritten: 0,
      totalExpected: 0,
      hasExpectedGap: false,
      completedStates: 0,
    }
  );

  run.writtenCount = totals.totalWritten;
  run.expectedCount = totals.hasExpectedGap ? null : totals.totalExpected;
  run.statesTotal = run.states.length;
  run.statesCompleted = totals.completedStates;
}

export function ensureRunState(
  run: MutableParcelsSyncRunStatus,
  stateCode: string
): MutableParcelsSyncStateProgress {
  const existing = run.states.find((state) => state.state === stateCode);
  if (existing) {
    return existing;
  }

  const created: MutableParcelsSyncStateProgress = {
    state: stateCode,
    expectedCount: null,
    isCompleted: false,
    writtenCount: 0,
    pagesFetched: 0,
    lastSourceId: null,
    updatedAt: null,
  };
  run.states.push(created);
  run.states.sort(compareStateProgress);
  return created;
}

export function appendRunLogLine(run: MutableParcelsSyncRunStatus, line: string): void {
  run.logTail.push(line);
  if (run.logTail.length > LOG_TAIL_LIMIT) {
    run.logTail.splice(0, run.logTail.length - LOG_TAIL_LIMIT);
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: status refresh intentionally merges multiple run sources with precedence rules
export function refreshRunFromFilesystem(status: MutableParcelsSyncStatusSnapshot): void {
  const latestPointer = readLatestPointer(status.snapshotRoot);
  const activeRunMarker = readActiveRunMarker(status.snapshotRoot);
  const activeExternalRun = detectActiveExternalRun(status.snapshotRoot);
  const terminalCompletedMarkerUpdatedAt =
    activeRunMarker !== null && activeRunMarker.phase === "completed" && !activeRunMarker.isRunning
      ? activeRunMarker.updatedAt
      : null;
  status.latestRunId = activeRunMarker?.runId ?? latestPointer.runId;
  status.latestRunCompletedAt = terminalCompletedMarkerUpdatedAt ?? latestPointer.updatedAt;

  const managedInProcessRunId =
    status.run.isRunning && status.run.reason !== "manual" ? status.run.runId : null;
  const runId =
    activeRunMarker?.runId ??
    activeExternalRun?.runId ??
    managedInProcessRunId ??
    latestPointer.runId ??
    status.run.runId;
  if (runId === null) {
    if (!status.run.isRunning && status.run.phase === "idle") {
      status.run.states = [];
      recomputeRunTotals(status.run);
    }
    return;
  }

  if (status.run.runId !== runId) {
    status.run = createInitialRunStatus();
    status.run.runId = runId;
  } else if (status.run.runId === null) {
    status.run.runId = runId;
  }

  const activeRunMarkerIsStale =
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    activeRunMarker.isRunning &&
    isActiveRunHeartbeatStale(activeRunMarker.updatedAt);

  if (activeRunMarkerIsStale) {
    status.run.isRunning = false;
    status.run.phase = "failed";
    status.run.endedAt = activeRunMarker?.updatedAt ?? new Date().toISOString();
    status.run.summary = `status heartbeat stale (>${String(
      Math.floor(ACTIVE_RUN_HEARTBEAT_STALE_MS / 1000)
    )}s without update)`;
    const markerStates = readStateCheckpoints(status.snapshotRoot, runId);
    if (markerStates.length > 0) {
      status.run.states = markerStates.slice();
      recomputeRunTotals(status.run);
    }
    return;
  }

  if (
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    !activeRunMarker.isRunning &&
    activeRunMarker.phase === "failed"
  ) {
    status.run.reason = "manual";
    status.run.isRunning = false;
    status.run.phase = "failed";
    status.run.endedAt =
      activeRunMarker.updatedAt ?? status.run.endedAt ?? new Date().toISOString();
    status.run.durationMs = null;
    status.run.exitCode = parseExitCodeFromSummary(activeRunMarker.summary);
    if (activeRunMarker.summary !== null) {
      status.run.summary = activeRunMarker.summary;
    }
    const markerStates = readStateCheckpoints(status.snapshotRoot, runId);
    if (markerStates.length > 0) {
      status.run.states = markerStates.slice();
      recomputeRunTotals(status.run);
    }
    return;
  }

  if (
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    !activeRunMarker.isRunning &&
    activeRunMarker.phase === "completed"
  ) {
    status.run.reason = "manual";
    status.run.isRunning = false;
    status.run.phase = "completed";
    status.run.endedAt = activeRunMarker.updatedAt ?? status.run.endedAt;
    status.run.durationMs = null;
    status.run.exitCode = null;
    if (activeRunMarker.summary !== null) {
      status.run.summary = activeRunMarker.summary;
    }

    const completedSummary = readRunSummary(status.snapshotRoot, runId);
    if (completedSummary !== null) {
      status.run.states = completedSummary.states.slice();
      if (completedSummary.startedAt !== null) {
        status.run.startedAt = completedSummary.startedAt;
      }
      if (status.run.endedAt === null && completedSummary.completedAt !== null) {
        status.run.endedAt = completedSummary.completedAt;
      }
      recomputeRunTotals(status.run);
      return;
    }

    const markerStates = readStateCheckpoints(status.snapshotRoot, runId);
    if (markerStates.length > 0) {
      status.run.states = markerStates.slice();
      recomputeRunTotals(status.run);
    }
    return;
  }

  if (
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    activeRunMarker.isRunning &&
    !activeRunMarkerIsStale
  ) {
    status.run.reason = "manual";
    status.run.isRunning = true;
    status.run.phase = activeRunMarker.phase;
    status.run.endedAt = null;
    status.run.durationMs = null;
    status.run.exitCode = null;
    status.run.summary = activeRunMarker.summary;
    if (status.run.startedAt === null && activeRunMarker.updatedAt !== null) {
      status.run.startedAt = activeRunMarker.updatedAt;
    }

    const markerStates = readStateCheckpoints(status.snapshotRoot, runId);
    if (markerStates.length > 0) {
      status.run.states = markerStates.slice();
      recomputeRunTotals(status.run);
    } else if (activeExternalRun !== null && activeExternalRun.runId === runId) {
      status.run.states = activeExternalRun.checkpointStates.slice();
      recomputeRunTotals(status.run);
    }

    if (status.run.phase === "building") {
      const buildProgress = readTileBuildProgressSnapshot(status.snapshotRoot, runId);
      status.run.summary = formatTileBuildSummary(
        status.run.summary,
        buildProgress,
        status.run.expectedCount
      );
    }

    return;
  }

  if (activeExternalRun !== null && runId === activeExternalRun.runId) {
    status.run.reason = "manual";
    status.run.isRunning = true;
    status.run.endedAt = null;
    status.run.durationMs = null;
    status.run.exitCode = null;
    if (
      status.run.phase === "idle" ||
      status.run.phase === "completed" ||
      status.run.phase === "failed"
    ) {
      status.run.phase = "extracting";
    }
    if (status.run.startedAt === null && activeExternalRun.touchedAtMs > 0) {
      status.run.startedAt = new Date(activeExternalRun.touchedAtMs).toISOString();
    }
    status.run.states = activeExternalRun.checkpointStates.slice();
    recomputeRunTotals(status.run);

    if (status.run.phase === "building") {
      const buildProgress = readTileBuildProgressSnapshot(status.snapshotRoot, runId);
      status.run.summary = formatTileBuildSummary(
        status.run.summary,
        buildProgress,
        status.run.expectedCount
      );
    }

    return;
  }

  const summary = readRunSummary(status.snapshotRoot, runId);
  if (summary !== null) {
    status.run.states = summary.states.slice();
    if (summary.startedAt !== null) {
      status.run.startedAt = summary.startedAt;
    }
    if (summary.completedAt !== null) {
      status.run.isRunning = false;
      status.run.endedAt = summary.completedAt;
      status.run.phase = "completed";
    }
    recomputeRunTotals(status.run);
    return;
  }

  const checkpointStates = readStateCheckpoints(status.snapshotRoot, runId);
  if (checkpointStates.length > 0) {
    status.run.states = checkpointStates.slice();
    recomputeRunTotals(status.run);
  }
}

export function startRunStatus(
  status: MutableParcelsSyncStatusSnapshot,
  reason: ParcelsSyncRunReason,
  runId: string
): void {
  status.run = {
    runId,
    reason,
    phase: "extracting",
    isRunning: true,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationMs: null,
    exitCode: null,
    summary: null,
    states: [],
    statesCompleted: 0,
    statesTotal: 0,
    writtenCount: 0,
    expectedCount: null,
    logTail: [],
  };
}

export function updateConfigStatus(
  status: MutableParcelsSyncStatusSnapshot,
  config: ParcelsSyncConfig
): void {
  status.enabled = config.enabled;
  status.mode = config.mode;
  status.intervalMs = config.intervalMs;
  status.requireStartupSuccess = config.requireStartupSuccess;
  status.snapshotRoot = config.snapshotRoot;
}

function snapshotRunStatus(run: MutableParcelsSyncRunStatus): ParcelsSyncRunStatus {
  return {
    runId: run.runId,
    reason: run.reason,
    phase: run.phase,
    isRunning: run.isRunning,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs: run.durationMs,
    exitCode: run.exitCode,
    summary: run.summary,
    states: run.states.map((state) => ({
      state: state.state,
      expectedCount: state.expectedCount,
      writtenCount: state.writtenCount,
      pagesFetched: state.pagesFetched,
      lastSourceId: state.lastSourceId,
      updatedAt: state.updatedAt,
      isCompleted: state.isCompleted,
    })),
    statesCompleted: run.statesCompleted,
    statesTotal: run.statesTotal,
    writtenCount: run.writtenCount,
    expectedCount: run.expectedCount,
    logTail: [...run.logTail],
  };
}

export function snapshotStatus(
  status: MutableParcelsSyncStatusSnapshot
): ParcelsSyncStatusSnapshot {
  return {
    enabled: status.enabled,
    mode: status.mode,
    intervalMs: status.intervalMs,
    requireStartupSuccess: status.requireStartupSuccess,
    snapshotRoot: status.snapshotRoot,
    latestRunId: status.latestRunId,
    latestRunCompletedAt: status.latestRunCompletedAt,
    run: snapshotRunStatus(status.run),
  };
}
