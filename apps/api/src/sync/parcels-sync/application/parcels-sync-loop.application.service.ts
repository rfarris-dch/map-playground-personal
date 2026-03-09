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
import {
  createDisabledSyncController,
  createManagedSyncRuntimeState,
  scheduleManagedSyncRun,
  startManagedSyncInterval,
  stopManagedSyncLoop,
} from "@/sync/sync-loop-runtime.service";
import type { RunCycleArgs } from "./parcels-sync-loop.application.service.types";

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
  startManagedSyncInterval(
    runtimeState,
    config.intervalMs,
    () =>
      runCycle({
        config,
        failOnError: false,
        reason: "interval",
        runtimeState,
      }),
    (error) => {
      const statusStore = getParcelsSyncStatusStore();
      statusStore.markRunFailed(String(error));
      console.error("[api] parcels auto-sync interval failure", error);
    }
  );
}

export async function startParcelsSyncLoop(): Promise<ParcelsSyncController> {
  const config = buildParcelsSyncConfig();
  configureParcelsSyncStatusStore(config);

  if (!config.enabled) {
    console.log("[api] parcels auto-sync disabled");
    return createDisabledSyncController();
  }

  if (config.mode === "external") {
    console.log(
      "[api] parcels auto-sync configured for external mode; skipping in-process sync loop"
    );
    return createDisabledSyncController();
  }

  if (!existsSync(config.syncScriptPath)) {
    throw new Error(`[api] parcels sync script not found: ${config.syncScriptPath}`);
  }

  const runtimeState: ParcelsSyncRuntimeState = createManagedSyncRuntimeState();

  await scheduleManagedSyncRun(runtimeState, () =>
    runCycle({
      config,
      failOnError: config.requireStartupSuccess,
      reason: "startup",
      runtimeState,
    })
  );

  startInterval(runtimeState, config);

  console.log(
    `[api] parcels auto-sync enabled (every ${Math.floor(config.intervalMs / 1000)}s, startupRequired=${String(
      config.requireStartupSuccess
    )})`
  );

  return {
    stop(): Promise<void> {
      return stopManagedSyncLoop(runtimeState);
    },
  };
}
