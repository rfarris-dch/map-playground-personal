const SYNC_STOP_WAIT_TIMEOUT_MS = 15_000;

export interface ManagedSyncChildProcess {
  readonly exited: Promise<number>;
  kill(signal?: number | string): void;
}

export interface ManagedSyncRuntimeState {
  activeChild: ManagedSyncChildProcess | null;
  activeRunPromise: Promise<void> | null;
  intervalHandle: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  isStopping: boolean;
}

export function createDisabledSyncController(): { stop(): Promise<void> } {
  return {
    stop(): Promise<void> {
      return Promise.resolve();
    },
  };
}

export function createManagedSyncRuntimeState(): ManagedSyncRuntimeState {
  return {
    activeChild: null,
    activeRunPromise: null,
    intervalHandle: null,
    isRunning: false,
    isStopping: false,
  };
}

function waitForDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function terminateManagedSyncProcess(
  runtimeState: ManagedSyncRuntimeState
): Promise<void> {
  const activeChild = runtimeState.activeChild;
  if (activeChild === null) {
    return;
  }

  try {
    activeChild.kill("SIGTERM");
  } catch {
    // Ignore termination errors and continue waiting for process exit.
  }

  const exitedAfterTerminate = await Promise.race([
    activeChild.exited.then(() => true),
    waitForDelay(SYNC_STOP_WAIT_TIMEOUT_MS).then(() => false),
  ]);
  if (exitedAfterTerminate) {
    return;
  }

  try {
    activeChild.kill("SIGKILL");
  } catch {
    // Ignore forced termination errors and continue waiting for process exit.
  }

  await Promise.race([activeChild.exited, waitForDelay(SYNC_STOP_WAIT_TIMEOUT_MS)]);
}

export function scheduleManagedSyncRun(
  runtimeState: ManagedSyncRuntimeState,
  runCycle: () => Promise<void>
): Promise<void> {
  const promise = runCycle().finally(() => {
    if (runtimeState.activeRunPromise === promise) {
      runtimeState.activeRunPromise = null;
    }
  });
  runtimeState.activeRunPromise = promise;
  return promise;
}

export function startManagedSyncInterval(
  runtimeState: ManagedSyncRuntimeState,
  intervalMs: number,
  runCycle: () => Promise<void>,
  onError: (error: unknown) => void
): void {
  runtimeState.intervalHandle = setInterval(() => {
    scheduleManagedSyncRun(runtimeState, runCycle).catch(onError);
  }, intervalMs);
}

export async function stopManagedSyncLoop(runtimeState: ManagedSyncRuntimeState): Promise<void> {
  if (runtimeState.isStopping) {
    return;
  }

  runtimeState.isStopping = true;
  if (runtimeState.intervalHandle) {
    clearInterval(runtimeState.intervalHandle);
    runtimeState.intervalHandle = null;
  }

  await terminateManagedSyncProcess(runtimeState);
  if (runtimeState.activeRunPromise !== null) {
    await Promise.race([runtimeState.activeRunPromise, waitForDelay(SYNC_STOP_WAIT_TIMEOUT_MS)]);
  }
}
