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

export interface ParcelsSyncDbLoadProgress {
  readonly activeWorkers: readonly string[];
  readonly completedStates: number | null;
  readonly currentFile: string | null;
  readonly loadedFiles: number | null;
  readonly percent: number | null;
  readonly stepKey: string;
  readonly totalFiles: number | null;
  readonly totalStates: number | null;
}

export interface ParcelsSyncTileBuildProgress {
  readonly convertAttempt: number | null;
  readonly convertAttemptTotal: number | null;
  readonly convertDone: number | null;
  readonly convertPercent: number | null;
  readonly convertTotal: number | null;
  readonly logBytes: number | null;
  readonly percent: number | null;
  readonly readFeatures: number | null;
  readonly stage: "build" | "convert" | "ready";
  readonly totalFeatures: number | null;
  readonly workDone: number | null;
  readonly workLeft: number | null;
  readonly workTotal: number | null;
}

export interface ParcelsSyncRunProgress {
  readonly dbLoad?: ParcelsSyncDbLoadProgress;
  readonly phase: ParcelsSyncPhase;
  readonly schemaVersion: 1;
  readonly tileBuild?: ParcelsSyncTileBuildProgress;
}

export interface ParcelsSyncRunStatus {
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly exitCode: number | null;
  readonly expectedCount: number | null;
  readonly isRunning: boolean;
  readonly logTail: readonly string[];
  readonly phase: ParcelsSyncPhase;
  readonly progress: ParcelsSyncRunProgress | null;
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
