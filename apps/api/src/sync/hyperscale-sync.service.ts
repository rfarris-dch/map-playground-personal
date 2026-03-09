import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBufferedCommand } from "@map-migration/ops/etl/command-runner";
import { parseBooleanFlag, parseIntervalSecondsAsMs } from "@/config/env-parsing.service";
import type {
  HyperscaleSyncConfig,
  HyperscaleSyncController,
  HyperscaleSyncRunResult,
} from "@/sync/hyperscale-sync.types";
import {
  createDisabledSyncController,
  createManagedSyncRuntimeState,
  scheduleManagedSyncRun,
  startManagedSyncInterval,
  stopManagedSyncLoop,
} from "@/sync/sync-loop-runtime.service";
import type { HyperscaleSyncRuntimeState } from "./hyperscale-sync.service.types";

function buildConfig(): HyperscaleSyncConfig {
  const serviceFilePath = fileURLToPath(import.meta.url);
  const serviceDirectory = dirname(serviceFilePath);
  const projectRoot = resolve(serviceDirectory, "../../../../");
  const syncScriptPath = resolve(projectRoot, "scripts/refresh-hyperscale.sh");

  return {
    enabled: parseBooleanFlag(process.env.AUTO_HYPERSCALE_SYNC, true),
    intervalMs: parseIntervalSecondsAsMs(process.env.AUTO_HYPERSCALE_SYNC_INTERVAL_SECONDS, 300),
    requireStartupSuccess: parseBooleanFlag(
      process.env.AUTO_HYPERSCALE_SYNC_STARTUP_REQUIRED,
      false
    ),
    projectRoot,
    syncScriptPath,
  };
}

function summarizeOutput(result: HyperscaleSyncRunResult): string {
  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return stderr;
  }

  const lines = result.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return "no output";
  }

  const tailLines = lines.slice(-5);
  return tailLines.join(" | ");
}

function isMirrorLockContention(result: HyperscaleSyncRunResult): boolean {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    output.includes("mirror-load: another mirror load is already running") ||
    output.includes("hyperscale-sync lock already held")
  );
}

export async function startHyperscaleSyncLoop(): Promise<HyperscaleSyncController> {
  const config = buildConfig();
  if (!config.enabled) {
    console.log("[api] hyperscale auto-sync disabled");
    return createDisabledSyncController();
  }

  if (!existsSync(config.syncScriptPath)) {
    const message = `[api] hyperscale sync script not found: ${config.syncScriptPath}`;
    if (config.requireStartupSuccess) {
      throw new Error(message);
    }

    console.warn(`${message}; startup continues because startupRequired=false`);
    return createDisabledSyncController();
  }

  const runtimeState: HyperscaleSyncRuntimeState = createManagedSyncRuntimeState();

  const runCycle = async (reason: "interval" | "startup", failOnError: boolean): Promise<void> => {
    if (runtimeState.isStopping) {
      return;
    }

    if (runtimeState.isRunning) {
      console.log(`[api] hyperscale auto-sync skipped (${reason}): previous cycle still running`);
      return;
    }

    runtimeState.isRunning = true;
    try {
      const result = await runBufferedCommand({
        args: [config.syncScriptPath],
        command: "bash",
        cwd: config.projectRoot,
        onProcessExit: () => {
          runtimeState.activeChild = null;
        },
        onProcessStart: (process) => {
          runtimeState.activeChild = process;
        },
      });
      const durationSeconds = (result.durationMs / 1000).toFixed(1);
      if (result.exitCode === 0) {
        console.log(`[api] hyperscale auto-sync success (${reason}) in ${durationSeconds}s`);
        return;
      }

      if (reason === "startup" && isMirrorLockContention(result)) {
        console.warn(
          "[api] hyperscale auto-sync startup deferred: mirror lock is currently held by another sync process"
        );
        return;
      }

      const summary = summarizeOutput(result);
      const message = `[api] hyperscale auto-sync failed (${reason}) exit=${result.exitCode}: ${summary}`;
      if (failOnError) {
        throw new Error(message);
      }
      console.error(message);
    } finally {
      runtimeState.activeChild = null;
      runtimeState.isRunning = false;
    }
  };

  if (config.requireStartupSuccess) {
    await scheduleManagedSyncRun(runtimeState, () => runCycle("startup", true));
  } else {
    scheduleManagedSyncRun(runtimeState, () => runCycle("startup", false)).catch((error) => {
      console.error("[api] hyperscale auto-sync startup failure", error);
    });
  }

  startManagedSyncInterval(
    runtimeState,
    config.intervalMs,
    () => runCycle("interval", false),
    (error) => {
      console.error("[api] hyperscale auto-sync interval failure", error);
    }
  );

  console.log(
    `[api] hyperscale auto-sync enabled (every ${Math.floor(config.intervalMs / 1000)}s, startupRequired=${String(
      config.requireStartupSuccess
    )})`
  );

  return {
    stop(): Promise<void> {
      return stopManagedSyncLoop(runtimeState);
    },
  };
}
