import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBooleanFlag, parseIntervalSecondsAsMs } from "@/config/env-parsing.service";
import type {
  HyperscaleSyncConfig,
  HyperscaleSyncController,
  HyperscaleSyncRunResult,
} from "@/sync/hyperscale-sync.types";
import type { HyperscaleSyncRuntimeState } from "./hyperscale-sync.service.types";

declare const Bun: {
  spawn(options: {
    cmd: readonly string[];
    cwd?: string;
    env?: Record<string, string>;
    stderr?: "inherit" | "pipe";
    stdout?: "inherit" | "pipe";
  }): {
    exited: Promise<number>;
    kill(signal?: number | string): void;
    stderr: ReadableStream<Uint8Array> | null;
    stdout: ReadableStream<Uint8Array> | null;
  };
};

const SYNC_STOP_WAIT_TIMEOUT_MS = 15_000;

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

function readStream(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }

  return new Response(stream).text();
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

function waitForDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function terminateActiveProcess(runtimeState: HyperscaleSyncRuntimeState): Promise<void> {
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

export async function startHyperscaleSyncLoop(): Promise<HyperscaleSyncController> {
  const config = buildConfig();
  if (!config.enabled) {
    console.log("[api] hyperscale auto-sync disabled");
    return {
      stop(): Promise<void> {
        return Promise.resolve();
      },
    };
  }

  if (!existsSync(config.syncScriptPath)) {
    const message = `[api] hyperscale sync script not found: ${config.syncScriptPath}`;
    if (config.requireStartupSuccess) {
      throw new Error(message);
    }

    console.warn(`${message}; startup continues because startupRequired=false`);
    return {
      stop(): Promise<void> {
        return Promise.resolve();
      },
    };
  }

  const runtimeState: HyperscaleSyncRuntimeState = {
    activeChild: null,
    activeRunPromise: null,
    intervalHandle: null,
    isRunning: false,
    isStopping: false,
  };

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
      const startedAt = Date.now();
      const child = Bun.spawn({
        cmd: ["bash", config.syncScriptPath],
        cwd: config.projectRoot,
        stderr: "pipe",
        stdout: "pipe",
      });
      runtimeState.activeChild = child;

      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        readStream(child.stdout),
        readStream(child.stderr),
      ]);
      const result: HyperscaleSyncRunResult = {
        durationMs: Date.now() - startedAt,
        exitCode,
        stderr,
        stdout,
      };
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

  const scheduleRunCycle = (
    reason: "interval" | "startup",
    failOnError: boolean
  ): Promise<void> => {
    const promise = runCycle(reason, failOnError).finally(() => {
      if (runtimeState.activeRunPromise === promise) {
        runtimeState.activeRunPromise = null;
      }
    });
    runtimeState.activeRunPromise = promise;
    return promise;
  };

  if (config.requireStartupSuccess) {
    await scheduleRunCycle("startup", true);
  } else {
    scheduleRunCycle("startup", false).catch((error) => {
      console.error("[api] hyperscale auto-sync startup failure", error);
    });
  }

  runtimeState.intervalHandle = setInterval(() => {
    scheduleRunCycle("interval", false).catch((error) => {
      console.error("[api] hyperscale auto-sync interval failure", error);
    });
  }, config.intervalMs);

  console.log(
    `[api] hyperscale auto-sync enabled (every ${Math.floor(config.intervalMs / 1000)}s, startupRequired=${String(
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
