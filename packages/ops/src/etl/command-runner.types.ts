export interface ManagedCommandProcess {
  readonly exited: Promise<number>;
  kill(signal?: string): void;
}

export interface RunCommandOutputOptions {
  readonly captureMaxBytes?: number;
  readonly onLine?: (line: string) => void;
}

export interface RunBufferedCommandOptions {
  readonly args?: readonly string[];
  readonly command: string;
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly onProcessExit?: () => void;
  readonly onProcessStart?: (process: ManagedCommandProcess) => void;
  readonly stderr?: RunCommandOutputOptions;
  readonly stdout?: RunCommandOutputOptions;
}

export interface RunBufferedCommandResult {
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}
