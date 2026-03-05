export interface MutablePollingState {
  abortController: AbortController | null;
  destroyed: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  refreshGeneration: number;
  timer: ReturnType<typeof setTimeout> | null;
}
