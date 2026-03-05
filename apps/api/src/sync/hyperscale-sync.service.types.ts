export interface HyperscaleSyncRuntimeState {
  intervalHandle: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
}
