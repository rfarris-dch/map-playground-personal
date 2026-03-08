import { randomBytes } from "node:crypto";
import { runBufferedCommand } from "@map-migration/ops/etl/command-runner";
import type {
  ParcelsSyncConfig,
  ParcelsSyncRunReason,
  ParcelsSyncRunResult,
} from "@/sync/parcels-sync.types";
import type { RunSyncScriptHooks } from "./process-stream-execution.service.types";

const ISO_REMOVE_PUNCTUATION_RE = /[-:]/g;
const ISO_MILLIS_SUFFIX_RE = /\.\d{3}Z$/;

function copyProcessEnvironment(
  runId: string,
  runReason: ParcelsSyncRunReason
): Record<string, string> {
  const env = Object.entries(process.env).reduce<Record<string, string>>(
    (nextEnv, [key, value]) => {
      if (typeof value === "string") {
        nextEnv[key] = value;
      }
      return nextEnv;
    },
    {}
  );
  env.RUN_ID = runId;
  env.RUN_REASON = runReason;
  return env;
}

export function runSyncScript(
  config: ParcelsSyncConfig,
  runId: string,
  runReason: ParcelsSyncRunReason,
  onLine: (line: string) => void,
  hooks: RunSyncScriptHooks = {}
): Promise<ParcelsSyncRunResult> {
  const options = {
    args: [config.syncScriptPath],
    command: "bash",
    cwd: config.projectRoot,
    env: copyProcessEnvironment(runId, runReason),
    stderr: {
      onLine,
    },
    stdout: {
      onLine,
    },
  };

  if (typeof hooks.onProcessExit === "function") {
    Object.assign(options, {
      onProcessExit: hooks.onProcessExit,
    });
  }

  if (typeof hooks.onProcessStart === "function") {
    Object.assign(options, {
      onProcessStart: hooks.onProcessStart,
    });
  }

  return runBufferedCommand(options);
}

export function summarizeOutput(result: ParcelsSyncRunResult): string {
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

  const tailLines = lines.slice(-6);
  return tailLines.join(" | ");
}

export function createManagedRunId(reason: ParcelsSyncRunReason): string {
  const iso = new Date().toISOString();
  const normalized = iso.replace(ISO_REMOVE_PUNCTUATION_RE, "").replace(ISO_MILLIS_SUFFIX_RE, "Z");
  const suffix = randomBytes(3).toString("hex");
  return `auto-${reason}-${normalized}-${suffix}`;
}
