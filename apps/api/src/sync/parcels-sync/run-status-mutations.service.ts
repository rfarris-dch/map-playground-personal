import type {
  MutableParcelsSyncRunStatus,
  MutableParcelsSyncStateProgress,
  MutableParcelsSyncStatusSnapshot,
  TileBuildProgressSnapshot,
} from "@/sync/parcels-sync/parcels-sync-runtime.types";
import {
  detectActiveExternalRun,
  readActiveRunMarker,
  readLatestPointer,
  readRunSummary,
  readStateCheckpoints,
} from "@/sync/parcels-sync/snapshot-read.service";
import {
  formatTileBuildSummary,
  readTileBuildProgressSnapshot,
} from "@/sync/parcels-sync/tile-build-progress.service";
import type {
  ParcelsSyncConfig,
  ParcelsSyncRunProgress,
  ParcelsSyncRunReason,
  ParcelsSyncRunStatus,
  ParcelsSyncStatusSnapshot,
} from "@/sync/parcels-sync.types";

const LOG_TAIL_LIMIT = 120;
const ACTIVE_RUN_HEARTBEAT_STALE_MS = 120 * 1000;
const EXIT_CODE_SUMMARY_RE = /(?:^|\s)exit_code=([0-9]+)/;
const RUNNING_PHASES: readonly MutableParcelsSyncRunStatus["phase"][] = [
  "extracting",
  "loading",
  "building",
  "publishing",
];

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

function createPhaseProgress(phase: MutableParcelsSyncRunStatus["phase"]): ParcelsSyncRunProgress {
  return {
    schemaVersion: 1,
    phase,
  };
}

function withPhaseProgress(
  progress: ParcelsSyncRunProgress | null,
  phase: MutableParcelsSyncRunStatus["phase"]
): ParcelsSyncRunProgress {
  if (progress === null) {
    return createPhaseProgress(phase);
  }

  return {
    schemaVersion: 1,
    phase,
    ...(typeof progress.dbLoad === "undefined" ? {} : { dbLoad: progress.dbLoad }),
    ...(typeof progress.tileBuild === "undefined" ? {} : { tileBuild: progress.tileBuild }),
  };
}

function isRunningPhase(phase: MutableParcelsSyncRunStatus["phase"]): boolean {
  return RUNNING_PHASES.includes(phase);
}

export function reconcileRunStatus(run: MutableParcelsSyncRunStatus): void {
  if (!isRunningPhase(run.phase)) {
    run.isRunning = false;
  }

  if (run.isRunning) {
    run.endedAt = null;
    run.exitCode = null;
  }

  if (run.phase === "completed") {
    run.exitCode = null;
  }

  run.progress = withPhaseProgress(run.progress, run.phase);
}

export function setRunPhase(
  run: MutableParcelsSyncRunStatus,
  phase: MutableParcelsSyncRunStatus["phase"]
): void {
  run.phase = phase;
  reconcileRunStatus(run);
}

function applyTileBuildProgress(
  run: MutableParcelsSyncRunStatus,
  buildProgress: TileBuildProgressSnapshot | null
): void {
  if (buildProgress === null) {
    reconcileRunStatus(run);
    return;
  }

  let stage: "build" | "convert" | "ready";
  if (buildProgress.stageHint === "convert") {
    stage = "convert";
  } else if (buildProgress.stageHint === "ready") {
    stage = "ready";
  } else {
    stage = "build";
  }
  const workDone = buildProgress.convertDone;
  const workTotal = buildProgress.convertTotal;
  const workLeft =
    typeof workDone === "number" &&
    Number.isFinite(workDone) &&
    typeof workTotal === "number" &&
    Number.isFinite(workTotal)
      ? Math.max(0, workTotal - workDone)
      : null;

  run.progress = {
    schemaVersion: 1,
    phase: run.phase,
    ...(typeof run.progress?.dbLoad === "undefined" ? {} : { dbLoad: run.progress.dbLoad }),
    tileBuild: {
      stage,
      percent: buildProgress.percent,
      logBytes: buildProgress.logBytes,
      readFeatures: buildProgress.readFeatures,
      totalFeatures: buildProgress.totalFeatures,
      workDone,
      workLeft,
      workTotal,
      convertPercent: buildProgress.convertPercent,
      convertDone: buildProgress.convertDone,
      convertTotal: buildProgress.convertTotal,
      convertAttempt: buildProgress.convertAttempt,
      convertAttemptTotal: buildProgress.convertAttemptTotal,
    },
  };
  reconcileRunStatus(run);
}

function applyCheckpointStatesIfPresent(
  status: MutableParcelsSyncStatusSnapshot,
  runId: string
): boolean {
  const checkpointStates = readStateCheckpoints(status.snapshotRoot, runId);
  if (checkpointStates.length === 0) {
    return false;
  }

  status.run.states = checkpointStates.slice();
  recomputeRunTotals(status.run);
  return true;
}

function applyBuildProgressSummary(status: MutableParcelsSyncStatusSnapshot, runId: string): void {
  if (status.run.phase !== "building") {
    return;
  }

  const buildProgress = readTileBuildProgressSnapshot(status.snapshotRoot, runId);
  status.run.summary = formatTileBuildSummary(
    status.run.summary,
    buildProgress,
    status.run.expectedCount
  );
  applyTileBuildProgress(status.run, buildProgress);
}

function resolveRunId(args: {
  readonly status: MutableParcelsSyncStatusSnapshot;
  readonly activeRunMarker: ReturnType<typeof readActiveRunMarker>;
  readonly activeExternalRun: ReturnType<typeof detectActiveExternalRun>;
  readonly latestPointer: ReturnType<typeof readLatestPointer>;
}): string | null {
  const managedInProcessRunId =
    args.status.run.isRunning && args.status.run.reason !== "manual" ? args.status.run.runId : null;
  return (
    args.activeRunMarker?.runId ??
    args.activeExternalRun?.runId ??
    managedInProcessRunId ??
    args.latestPointer.runId ??
    args.status.run.runId
  );
}

function ensureRunId(status: MutableParcelsSyncStatusSnapshot, runId: string): void {
  if (status.run.runId !== runId) {
    status.run = createInitialRunStatus();
    status.run.runId = runId;
    return;
  }

  if (status.run.runId === null) {
    status.run.runId = runId;
  }
}

function applyStaleActiveMarkerIfAny(args: {
  readonly status: MutableParcelsSyncStatusSnapshot;
  readonly runId: string;
  readonly activeRunMarker: ReturnType<typeof readActiveRunMarker>;
}): boolean {
  const { status, runId, activeRunMarker } = args;
  const isStale =
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    activeRunMarker.isRunning &&
    isActiveRunHeartbeatStale(activeRunMarker.updatedAt);
  if (!isStale) {
    return false;
  }

  status.run.isRunning = false;
  status.run.phase = "failed";
  status.run.endedAt = activeRunMarker?.updatedAt ?? new Date().toISOString();
  status.run.summary = `status heartbeat stale (>${String(
    Math.floor(ACTIVE_RUN_HEARTBEAT_STALE_MS / 1000)
  )}s without update)`;
  status.run.progress = withPhaseProgress(null, status.run.phase);
  reconcileRunStatus(status.run);
  applyCheckpointStatesIfPresent(status, runId);
  return true;
}

function applyFailedMarkerIfAny(args: {
  readonly status: MutableParcelsSyncStatusSnapshot;
  readonly runId: string;
  readonly activeRunMarker: ReturnType<typeof readActiveRunMarker>;
}): boolean {
  const { status, runId, activeRunMarker } = args;
  const isFailedMarker =
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    !activeRunMarker.isRunning &&
    activeRunMarker.phase === "failed";
  if (!isFailedMarker) {
    return false;
  }

  status.run.reason = "manual";
  status.run.isRunning = false;
  status.run.phase = "failed";
  status.run.endedAt = activeRunMarker.updatedAt ?? status.run.endedAt ?? new Date().toISOString();
  status.run.durationMs = null;
  status.run.exitCode = parseExitCodeFromSummary(activeRunMarker.summary);
  if (activeRunMarker.summary !== null) {
    status.run.summary = activeRunMarker.summary;
  }
  status.run.progress = withPhaseProgress(activeRunMarker.progress, status.run.phase);
  reconcileRunStatus(status.run);
  applyCheckpointStatesIfPresent(status, runId);
  return true;
}

function applyCompletedMarkerIfAny(args: {
  readonly status: MutableParcelsSyncStatusSnapshot;
  readonly runId: string;
  readonly activeRunMarker: ReturnType<typeof readActiveRunMarker>;
}): boolean {
  const { status, runId, activeRunMarker } = args;
  const isCompletedMarker =
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    !activeRunMarker.isRunning &&
    activeRunMarker.phase === "completed";
  if (!isCompletedMarker) {
    return false;
  }

  status.run.reason = "manual";
  status.run.isRunning = false;
  status.run.phase = "completed";
  status.run.endedAt = activeRunMarker.updatedAt ?? status.run.endedAt;
  status.run.durationMs = null;
  status.run.exitCode = null;
  if (activeRunMarker.summary !== null) {
    status.run.summary = activeRunMarker.summary;
  }
  status.run.progress = withPhaseProgress(activeRunMarker.progress, status.run.phase);
  reconcileRunStatus(status.run);

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
    return true;
  }

  applyCheckpointStatesIfPresent(status, runId);
  return true;
}

function applyRunningMarkerIfAny(args: {
  readonly status: MutableParcelsSyncStatusSnapshot;
  readonly runId: string;
  readonly activeRunMarker: ReturnType<typeof readActiveRunMarker>;
  readonly activeExternalRun: ReturnType<typeof detectActiveExternalRun>;
}): boolean {
  const { status, runId, activeRunMarker, activeExternalRun } = args;
  const isRunningMarker =
    activeRunMarker !== null &&
    activeRunMarker.runId === runId &&
    activeRunMarker.isRunning &&
    !isActiveRunHeartbeatStale(activeRunMarker.updatedAt);
  if (!isRunningMarker) {
    return false;
  }

  status.run.reason = "manual";
  status.run.isRunning = true;
  status.run.phase = activeRunMarker.phase;
  status.run.endedAt = null;
  status.run.durationMs = null;
  status.run.exitCode = null;
  status.run.summary = activeRunMarker.summary;
  status.run.progress = withPhaseProgress(activeRunMarker.progress, status.run.phase);
  if (status.run.startedAt === null && activeRunMarker.updatedAt !== null) {
    status.run.startedAt = activeRunMarker.updatedAt;
  }
  reconcileRunStatus(status.run);

  if (
    !applyCheckpointStatesIfPresent(status, runId) &&
    activeExternalRun !== null &&
    activeExternalRun.runId === runId
  ) {
    status.run.states = activeExternalRun.checkpointStates.slice();
    recomputeRunTotals(status.run);
  }

  applyBuildProgressSummary(status, runId);
  return true;
}

function applyActiveExternalRunIfAny(args: {
  readonly status: MutableParcelsSyncStatusSnapshot;
  readonly runId: string;
  readonly activeExternalRun: ReturnType<typeof detectActiveExternalRun>;
}): boolean {
  const { status, runId, activeExternalRun } = args;
  if (activeExternalRun === null || runId !== activeExternalRun.runId) {
    return false;
  }

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
  status.run.progress = withPhaseProgress(status.run.progress, status.run.phase);
  reconcileRunStatus(status.run);
  status.run.states = activeExternalRun.checkpointStates.slice();
  recomputeRunTotals(status.run);
  applyBuildProgressSummary(status, runId);
  return true;
}

function applySummaryFallbackIfAny(
  status: MutableParcelsSyncStatusSnapshot,
  runId: string
): boolean {
  const summary = readRunSummary(status.snapshotRoot, runId);
  if (summary === null) {
    return false;
  }

  status.run.states = summary.states.slice();
  if (summary.startedAt !== null) {
    status.run.startedAt = summary.startedAt;
  }
  if (summary.completedAt !== null) {
    status.run.isRunning = false;
    status.run.endedAt = summary.completedAt;
    status.run.phase = "completed";
  }
  reconcileRunStatus(status.run);
  recomputeRunTotals(status.run);
  return true;
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
    progress: null,
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

  const runId = resolveRunId({
    status,
    activeRunMarker,
    activeExternalRun,
    latestPointer,
  });
  if (runId === null) {
    if (!status.run.isRunning && status.run.phase === "idle") {
      status.run.states = [];
      status.run.progress = withPhaseProgress(null, status.run.phase);
      reconcileRunStatus(status.run);
      recomputeRunTotals(status.run);
    }
    return;
  }

  ensureRunId(status, runId);

  if (
    applyStaleActiveMarkerIfAny({
      status,
      runId,
      activeRunMarker,
    })
  ) {
    return;
  }

  if (
    applyFailedMarkerIfAny({
      status,
      runId,
      activeRunMarker,
    })
  ) {
    return;
  }

  if (
    applyCompletedMarkerIfAny({
      status,
      runId,
      activeRunMarker,
    })
  ) {
    return;
  }

  if (
    applyRunningMarkerIfAny({
      status,
      runId,
      activeRunMarker,
      activeExternalRun,
    })
  ) {
    return;
  }

  if (
    applyActiveExternalRunIfAny({
      status,
      runId,
      activeExternalRun,
    })
  ) {
    return;
  }

  if (applySummaryFallbackIfAny(status, runId)) {
    return;
  }

  if (applyCheckpointStatesIfPresent(status, runId)) {
    reconcileRunStatus(status.run);
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
    progress: createPhaseProgress("extracting"),
    states: [],
    statesCompleted: 0,
    statesTotal: 0,
    writtenCount: 0,
    expectedCount: null,
    logTail: [],
  };
  reconcileRunStatus(status.run);
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
    progress:
      run.progress === null
        ? null
        : {
            schemaVersion: 1,
            phase: run.progress.phase,
            ...(typeof run.progress.dbLoad === "undefined"
              ? {}
              : { dbLoad: { ...run.progress.dbLoad } }),
            ...(typeof run.progress.tileBuild === "undefined"
              ? {}
              : { tileBuild: { ...run.progress.tileBuild } }),
          },
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
