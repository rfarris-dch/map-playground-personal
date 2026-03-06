import { existsSync } from "node:fs";
import {
  configureParcelsSyncStatusStore,
  getParcelsSyncStatusStore,
  refreshParcelsSyncStatusStore,
} from "@/sync/parcels-sync/application/parcels-sync-store.service";
import { buildParcelsSyncConfig } from "@/sync/parcels-sync/config-env.service";
import type { ParcelsSyncRuntimeState } from "@/sync/parcels-sync/parcels-sync-runtime.types";
import {
  createManagedRunId,
  runSyncScript,
  summarizeOutput,
} from "@/sync/parcels-sync/process-stream-execution.service";
import type {
  ParcelsSyncConfig,
  ParcelsSyncController,
  ParcelsSyncRunReason,
} from "@/sync/parcels-sync.types";
import type { RunCycleArgs } from "./parcels-sync-loop.application.service.types";

const SYNC_STOP_WAIT_TIMEOUT_MS = 15_000;

function createDisabledController(): ParcelsSyncController {
  return {
    stop(): Promise<void> {
      return Promise.resolve();
    },
  };
}

function waitForDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function terminateActiveProcess(runtimeState: ParcelsSyncRuntimeState): Promise<void> {
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

function scheduleRunCycle(args: RunCycleArgs): Promise<void> {
  const { runtimeState } = args;
  const promise = runCycle(args).finally(() => {
    if (runtimeState.activeRunPromise === promise) {
      runtimeState.activeRunPromise = null;
    }
  });
  runtimeState.activeRunPromise = promise;
  return promise;
}

async function runCycle(args: RunCycleArgs): Promise<void> {
  const statusStore = getParcelsSyncStatusStore();
  const { config, failOnError, reason, runtimeState } = args;

  if (runtimeState.isStopping) {
    return;
  }

  if (runtimeState.isRunning) {
    console.log(`[api] parcels auto-sync skipped (${reason}): previous cycle still running`);
    return;
  }

  const runReason: ParcelsSyncRunReason = reason;
  const runId = createManagedRunId(runReason);
  statusStore.startRun(runReason, runId);
  runtimeState.isRunning = true;

  try {
    const result = await runSyncScript(
      config,
      runId,
      runReason,
      (line) => statusStore.applyOutputLine(line),
      {
        onProcessStart: (process) => {
          runtimeState.activeChild = process;
        },
        onProcessExit: () => {
          runtimeState.activeChild = null;
        },
      }
    );
    const summary = summarizeOutput(result);
    statusStore.finalizeRun(result, {
      endedAt: new Date().toISOString(),
      summary,
    });
    if (result.exitCode === 0) {
      statusStore.markRunSucceeded();
    } else {
      statusStore.markRunFailed(summary);
    }

    refreshParcelsSyncStatusStore();

    const durationSeconds = (result.durationMs / 1000).toFixed(1);
    if (result.exitCode === 0) {
      console.log(`[api] parcels auto-sync success (${reason}) in ${durationSeconds}s`);
      return;
    }

    const message = `[api] parcels auto-sync failed (${reason}) exit=${result.exitCode}: ${summary}`;
    if (failOnError) {
      throw new Error(message);
    }
    console.error(message);
  } finally {
    runtimeState.isRunning = false;
    statusStore.markRunStopped();
  }
}

function startInterval(runtimeState: ParcelsSyncRuntimeState, config: ParcelsSyncConfig): void {
  runtimeState.intervalHandle = setInterval(() => {
    scheduleRunCycle({
      config,
      failOnError: false,
      reason: "interval",
      runtimeState,
    }).catch((error) => {
      const statusStore = getParcelsSyncStatusStore();
      statusStore.markRunFailed(String(error));
      console.error("[api] parcels auto-sync interval failure", error);
    });
  }, config.intervalMs);
}

export async function startParcelsSyncLoop(): Promise<ParcelsSyncController> {
  const config = buildParcelsSyncConfig();
  configureParcelsSyncStatusStore(config);

  if (!config.enabled) {
    console.log("[api] parcels auto-sync disabled");
    return createDisabledController();
  }

  if (config.mode === "external") {
    console.log(
      "[api] parcels auto-sync configured for external mode; skipping in-process sync loop"
    );
    return createDisabledController();
  }

  if (!existsSync(config.syncScriptPath)) {
    throw new Error(`[api] parcels sync script not found: ${config.syncScriptPath}`);
  }

  const runtimeState: ParcelsSyncRuntimeState = {
    activeChild: null,
    activeRunPromise: null,
    intervalHandle: null,
    isRunning: false,
    isStopping: false,
  };

  await scheduleRunCycle({
    config,
    failOnError: config.requireStartupSuccess,
    reason: "startup",
    runtimeState,
  });

  startInterval(runtimeState, config);

  console.log(
    `[api] parcels auto-sync enabled (every ${Math.floor(config.intervalMs / 1000)}s, startupRequired=${String(
      config.requireStartupSuccess
    )})`
  );

  return {
    async stop(): Promise<void> {
      if (runtimeState.isStopping) {
        return;
      }

      runtimeState.isStopping = true;
      if (runtimeState.intervalHandle) {
        clearInterval(runtimeState.intervalHandle);
        runtimeState.intervalHandle = null;
      }

      await terminateActiveProcess(runtimeState);
      if (runtimeState.activeRunPromise !== null) {
        await Promise.race([
          runtimeState.activeRunPromise,
          waitForDelay(SYNC_STOP_WAIT_TIMEOUT_MS),
        ]);
      }
    },
  };
}
