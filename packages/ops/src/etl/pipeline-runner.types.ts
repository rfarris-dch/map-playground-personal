export type PipelineRunnerDataset = "flood" | "hydro-basins" | "parcels";

export type PipelineRunnerPhase =
  | "idle"
  | "extracting"
  | "loading"
  | "building"
  | "publishing"
  | "completed"
  | "failed";

export type PipelineRunnerReason = "startup" | "interval" | "manual" | "unknown";

export interface PipelineRunnerCommandDefinition {
  readonly args: readonly string[];
  readonly command: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly retries?: number;
}

export interface PipelineRunnerStepDefinition {
  readonly assetKey: string;
  readonly commands: readonly PipelineRunnerCommandDefinition[];
  readonly deps?: readonly string[];
  readonly phase: PipelineRunnerPhase;
}

export interface PipelineRunnerDatasetDefinition {
  readonly dataset: PipelineRunnerDataset;
  readonly snapshotDataset: "environmental-flood" | "environmental-hydro-basins" | "parcels";
  readonly steps: readonly PipelineRunnerStepDefinition[];
}

export interface RunPipelineOptions {
  readonly dataset: PipelineRunnerDataset;
  readonly env?: NodeJS.ProcessEnv;
  readonly projectRoot?: string;
  readonly reason?: PipelineRunnerReason;
  readonly runId?: string;
}

export interface PipelineRunnerStateProgress {
  readonly expectedCount: number | null;
  readonly isCompleted: boolean;
  readonly lastSourceId: number | null;
  readonly pagesFetched: number;
  readonly state: string;
  readonly updatedAt: string | null;
  readonly writtenCount: number;
}

export interface PipelineRunnerStatusFileRun {
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly exitCode: number | null;
  readonly expectedCount: number | null;
  readonly isRunning: boolean;
  readonly logTail: readonly string[];
  readonly phase: PipelineRunnerPhase;
  readonly progress: {
    readonly phase: PipelineRunnerPhase;
    readonly schemaVersion: 1;
  } | null;
  readonly reason: PipelineRunnerReason | null;
  readonly runId: string | null;
  readonly startedAt: string | null;
  readonly states: readonly PipelineRunnerStateProgress[];
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly summary: string | null;
  readonly writtenCount: number;
}

export interface PipelineRunnerStatusFile {
  readonly enabled: boolean;
  readonly generatedAt: string;
  readonly intervalMs: number;
  readonly latestRunCompletedAt: string | null;
  readonly latestRunId: string | null;
  readonly mode: "external";
  readonly requireStartupSuccess: boolean;
  readonly run: PipelineRunnerStatusFileRun;
  readonly snapshotRoot: string;
  readonly status: "ok";
}

export interface RunPipelineResult {
  readonly runId: string;
  readonly snapshotRoot: string;
  readonly statusFilePath: string;
}
