export type DuckDbOutputMode = "csv" | "json" | "text";

export interface DuckDbCliInvocation {
  readonly args: readonly string[];
  readonly command: string;
}

export interface DuckDbCliOptions {
  readonly bootstrapPath: string;
  readonly cwd?: string;
  readonly databasePath: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly outputMode?: DuckDbOutputMode;
  readonly readOnly?: boolean;
  readonly sql: string;
  readonly stderrCaptureMaxBytes?: number;
  readonly stdoutCaptureMaxBytes?: number;
}
