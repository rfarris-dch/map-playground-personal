export interface HyperscaleSyncController {
  stop(): Promise<void>;
}

export interface HyperscaleSyncConfig {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly projectRoot: string;
  readonly requireStartupSuccess: boolean;
  readonly syncScriptPath: string;
}

export interface HyperscaleSyncRunResult {
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}
