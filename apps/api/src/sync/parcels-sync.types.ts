export interface ParcelsSyncController {
  stop(): void;
}

export type ParcelsSyncMode = "external" | "in-process";

export interface ParcelsSyncConfig {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly mode: ParcelsSyncMode;
  readonly projectRoot: string;
  readonly requireStartupSuccess: boolean;
  readonly snapshotRoot: string;
  readonly syncScriptPath: string;
}

export type ParcelsSyncRunReason = "startup" | "interval" | "manual" | "unknown";

export type ParcelsSyncPhase =
  | "idle"
  | "extracting"
  | "loading"
  | "building"
  | "publishing"
  | "completed"
  | "failed";

export interface ParcelsSyncStateProgress {
  readonly expectedCount: number | null;
  readonly isCompleted?: boolean;
  readonly lastSourceId: number | null;
  readonly pagesFetched: number;
  readonly state: string;
  readonly updatedAt: string | null;
  readonly writtenCount: number;
}

export interface ParcelsSyncRunStatus {
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly exitCode: number | null;
  readonly expectedCount: number | null;
  readonly isRunning: boolean;
  readonly logTail: readonly string[];
  readonly phase: ParcelsSyncPhase;
  readonly reason: ParcelsSyncRunReason | null;
  readonly runId: string | null;
  readonly startedAt: string | null;
  readonly states: readonly ParcelsSyncStateProgress[];
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly summary: string | null;
  readonly writtenCount: number;
}

export interface ParcelsSyncStatusSnapshot {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly latestRunCompletedAt: string | null;
  readonly latestRunId: string | null;
  readonly mode: ParcelsSyncMode;
  readonly requireStartupSuccess: boolean;
  readonly run: ParcelsSyncRunStatus;
  readonly snapshotRoot: string;
}

export interface ParcelsSyncRunResult {
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}
