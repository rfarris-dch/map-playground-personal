import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBooleanFlag, parseIntervalSecondsAsMs } from "../config/env-parsing.service";
import type {
  HyperscaleSyncConfig,
  HyperscaleSyncController,
  HyperscaleSyncRunResult,
} from "./hyperscale-sync.types";

declare const Bun: {
  spawn(options: {
    cmd: readonly string[];
    cwd?: string;
    env?: Record<string, string>;
    stderr?: "inherit" | "pipe";
    stdout?: "inherit" | "pipe";
  }): {
    exited: Promise<number>;
    stderr: ReadableStream<Uint8Array> | null;
    stdout: ReadableStream<Uint8Array> | null;
  };
};

interface HyperscaleSyncRuntimeState {
  intervalHandle: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
}

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

async function runSyncScript(config: HyperscaleSyncConfig): Promise<HyperscaleSyncRunResult> {
  const startedAt = Date.now();
  const child = Bun.spawn({
    cmd: ["bash", config.syncScriptPath],
    cwd: config.projectRoot,
    stderr: "pipe",
    stdout: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    readStream(child.stdout),
    readStream(child.stderr),
  ]);

  return {
    durationMs: Date.now() - startedAt,
    exitCode,
    stderr,
    stdout,
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
  return output.includes("mirror-load: another mirror load is already running");
}

export async function startHyperscaleSyncLoop(): Promise<HyperscaleSyncController> {
  const config = buildConfig();
  if (!config.enabled) {
    console.log("[api] hyperscale auto-sync disabled");
    return {
      stop(): void {
        return;
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
      stop(): void {
        return;
      },
    };
  }

  const runtimeState: HyperscaleSyncRuntimeState = {
    intervalHandle: null,
    isRunning: false,
  };

  const runCycle = async (reason: "interval" | "startup", failOnError: boolean): Promise<void> => {
    if (runtimeState.isRunning) {
      console.log(`[api] hyperscale auto-sync skipped (${reason}): previous cycle still running`);
      return;
    }

    runtimeState.isRunning = true;
    try {
      const result = await runSyncScript(config);
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
      runtimeState.isRunning = false;
    }
  };

  if (config.requireStartupSuccess) {
    await runCycle("startup", true);
  } else {
    runCycle("startup", false).catch((error) => {
      console.error("[api] hyperscale auto-sync startup failure", error);
    });
  }

  runtimeState.intervalHandle = setInterval(() => {
    runCycle("interval", false).catch((error) => {
      console.error("[api] hyperscale auto-sync interval failure", error);
    });
  }, config.intervalMs);

  console.log(
    `[api] hyperscale auto-sync enabled (every ${Math.floor(config.intervalMs / 1000)}s, startupRequired=${String(
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
