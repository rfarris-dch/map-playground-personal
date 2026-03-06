export interface ManagedSyncChildProcess {
  readonly exited: Promise<number>;
  kill(signal?: number | string): void;
}

export interface HyperscaleSyncRuntimeState {
  activeChild: ManagedSyncChildProcess | null;
  activeRunPromise: Promise<void> | null;
  intervalHandle: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  isStopping: boolean;
}
