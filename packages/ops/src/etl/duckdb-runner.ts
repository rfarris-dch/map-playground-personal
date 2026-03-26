import { runBufferedCommand } from "./command-runner";
import type { RunBufferedCommandResult } from "./command-runner.types";
import type { DuckDbCliInvocation, DuckDbCliOptions } from "./duckdb-runner.types";

function trimToNull(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEnv(env: NodeJS.ProcessEnv | undefined): Record<string, string> | undefined {
  if (env === undefined) {
    return undefined;
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function resolveDuckDbCliCommand(env: NodeJS.ProcessEnv = process.env): string {
  return (
    trimToNull(env.DUCKDB_CLI) ??
    trimToNull(env.DUCKDB_EXECUTABLE) ??
    trimToNull(env.DUCKDB_BIN) ??
    "duckdb"
  );
}

export function buildDuckDbCliInvocation(options: DuckDbCliOptions): DuckDbCliInvocation {
  const args: string[] = ["-batch", "-bail", "-init", options.bootstrapPath];

  if (options.readOnly ?? false) {
    args.push("-readonly");
  }

  if (options.outputMode === "csv") {
    args.push("-csv");
  } else if (options.outputMode === "json") {
    args.push("-json");
  }

  args.push(options.databasePath, "-c", options.sql);

  return {
    args,
    command: resolveDuckDbCliCommand(options.env),
  };
}

export function runDuckDbCli(options: DuckDbCliOptions): Promise<RunBufferedCommandResult> {
  const invocation = buildDuckDbCliInvocation(options);
  const env = normalizeEnv(options.env);

  return runBufferedCommand({
    args: invocation.args,
    command: invocation.command,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(env === undefined ? {} : { env }),
  });
}
