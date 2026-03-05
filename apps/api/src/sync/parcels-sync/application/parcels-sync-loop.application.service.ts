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

function createDisabledController(): ParcelsSyncController {
  return {
    stop(): void {
      return;
    },
  };
}

async function runCycle(args: RunCycleArgs): Promise<void> {
  const statusStore = getParcelsSyncStatusStore();
  const { config, failOnError, reason, runtimeState } = args;

  if (runtimeState.isRunning) {
    console.log(`[api] parcels auto-sync skipped (${reason}): previous cycle still running`);
    return;
  }

  const runReason: ParcelsSyncRunReason = reason;
  const runId = createManagedRunId(runReason);
  statusStore.startRun(runReason, runId);
  runtimeState.isRunning = true;

  try {
    const result = await runSyncScript(config, runId, (line) => statusStore.applyOutputLine(line));
    const summary = summarizeOutput(result);
    statusStore.finalizeRun(result, {
      endedAt: new Date().toISOString(),
      summary,
    });
    refreshParcelsSyncStatusStore();

    const durationSeconds = (result.durationMs / 1000).toFixed(1);
    if (result.exitCode === 0) {
      statusStore.markRunSucceeded();
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
    runCycle({
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
    intervalHandle: null,
    isRunning: false,
  };

  await runCycle({
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
    stop(): void {
      if (runtimeState.intervalHandle) {
        clearInterval(runtimeState.intervalHandle);
        runtimeState.intervalHandle = null;
      }
    },
  };
}
