import { existsSync } from "node:fs";
import { buildParcelsSyncConfig } from "./parcels-sync/config-env.service";
import type { ParcelsSyncRuntimeState } from "./parcels-sync/parcels-sync-runtime.types";
import {
  createManagedRunId,
  runSyncScript,
  summarizeOutput,
} from "./parcels-sync/process-stream-execution.service";
import { ParcelsSyncStatusStore } from "./parcels-sync/status-store.service";
import type {
  ParcelsSyncController,
  ParcelsSyncRunReason,
  ParcelsSyncStatusSnapshot,
} from "./parcels-sync.types";

const statusStore = new ParcelsSyncStatusStore(buildParcelsSyncConfig());

export function getParcelsSyncStatusSnapshot(): ParcelsSyncStatusSnapshot {
  try {
    statusStore.refreshFromFilesystem();
  } catch (error) {
    console.error("[api] parcels sync status refresh failed", error);
  }
  return statusStore.snapshot();
}

export async function startParcelsSyncLoop(): Promise<ParcelsSyncController> {
  const config = buildParcelsSyncConfig();
  statusStore.updateConfig(config);
  statusStore.refreshFromFilesystem();

  if (!config.enabled) {
    console.log("[api] parcels auto-sync disabled");
    return {
      stop(): void {
        return;
      },
    };
  }

  if (config.mode === "external") {
    console.log(
      "[api] parcels auto-sync configured for external mode; skipping in-process sync loop"
    );
    return {
      stop(): void {
        return;
      },
    };
  }

  if (!existsSync(config.syncScriptPath)) {
    throw new Error(`[api] parcels sync script not found: ${config.syncScriptPath}`);
  }

  const runtimeState: ParcelsSyncRuntimeState = {
    intervalHandle: null,
    isRunning: false,
  };

  const runCycle = async (reason: "interval" | "startup", failOnError: boolean): Promise<void> => {
    if (runtimeState.isRunning) {
      console.log(`[api] parcels auto-sync skipped (${reason}): previous cycle still running`);
      return;
    }

    const runReason: ParcelsSyncRunReason = reason;
    const runId = createManagedRunId(runReason);
    statusStore.startRun(runReason, runId);
    runtimeState.isRunning = true;

    try {
      const result = await runSyncScript(config, runId, (line) =>
        statusStore.applyOutputLine(line)
      );
      const endedAt = new Date().toISOString();
      const summary = summarizeOutput(result);

      statusStore.finalizeRun(result, {
        endedAt,
        summary,
      });
      statusStore.refreshFromFilesystem();

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
  };

  await runCycle("startup", config.requireStartupSuccess);

  runtimeState.intervalHandle = setInterval(() => {
    runCycle("interval", false).catch((error) => {
      statusStore.markRunFailed(String(error));
      console.error("[api] parcels auto-sync interval failure", error);
    });
  }, config.intervalMs);

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
