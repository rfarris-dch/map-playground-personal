import type {
  ParcelsSyncMode,
  ParcelsSyncPhase,
  ParcelsSyncRunProgress,
  ParcelsSyncRunReason,
} from "@/sync/parcels-sync.types";

export interface MutableParcelsSyncRunStatus {
  durationMs: number | null;
  endedAt: string | null;
  exitCode: number | null;
  expectedCount: number | null;
  isRunning: boolean;
  logTail: string[];
  phase: ParcelsSyncPhase;
  progress: ParcelsSyncRunProgress | null;
  reason: ParcelsSyncRunReason | null;
  runId: string | null;
  startedAt: string | null;
  states: MutableParcelsSyncStateProgress[];
  statesCompleted: number;
  statesTotal: number;
  summary: string | null;
  writtenCount: number;
}

export interface MutableParcelsSyncStateProgress {
  expectedCount: number | null;
  isCompleted: boolean;
  lastSourceId: number | null;
  pagesFetched: number;
  state: string;
  updatedAt: string | null;
  writtenCount: number;
}

export interface MutableParcelsSyncStatusSnapshot {
  enabled: boolean;
  intervalMs: number;
  latestRunCompletedAt: string | null;
  latestRunId: string | null;
  mode: ParcelsSyncMode;
  requireStartupSuccess: boolean;
  run: MutableParcelsSyncRunStatus;
  snapshotRoot: string;
}

export interface ParcelsSyncRuntimeState {
  intervalHandle: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
}

export interface ParsedRunSummary {
  readonly completedAt: string | null;
  readonly startedAt: string | null;
  readonly states: readonly MutableParcelsSyncStateProgress[];
}

export interface ParsedLatestPointer {
  readonly runId: string | null;
  readonly updatedAt: string | null;
}

export interface ActiveExternalRunCandidate {
  readonly checkpointStates: readonly MutableParcelsSyncStateProgress[];
  readonly runId: string;
  readonly touchedAtMs: number;
}

export interface ActiveRunMarker {
  readonly isRunning: boolean;
  readonly phase: ParcelsSyncPhase;
  readonly progress: ParcelsSyncRunProgress | null;
  readonly runId: string;
  readonly summary: string | null;
  readonly updatedAt: string | null;
}

export interface TileBuildProgressSnapshot {
  readonly convertAttempt: number | null;
  readonly convertAttemptTotal: number | null;
  readonly convertDone: number | null;
  readonly convertPercent: number | null;
  readonly convertTotal: number | null;
  readonly logBytes: number | null;
  readonly percent: number | null;
  readonly readFeatures: number | null;
  readonly stageHint: "build" | "convert" | "ready";
  readonly totalFeatures: number | null;
}
