import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ParcelsSyncStatusResponseSchema, type PipelineDataset } from "@map-migration/contracts";
import { runBufferedCommand } from "@map-migration/ops/etl/command-runner";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DAGSTER_SOURCE_ROOT = join(PROJECT_ROOT, "apps/dagster/src");
const DAGSTER_HOME_DEFAULT = join(PROJECT_ROOT, "apps/dagster/.dagster");
const DAGSTER_VENV_PYTHON = join(PROJECT_ROOT, "apps/dagster/.venv/bin/python");

function resolveDagsterPythonBin(): string {
  const configuredPython =
    process.env.MAP_DAGSTER_PYTHON_BIN ?? process.env.DAGSTER_PYTHON_BIN ?? null;
  if (typeof configuredPython === "string" && configuredPython.trim().length > 0) {
    return configuredPython.trim();
  }

  if (existsSync(DAGSTER_VENV_PYTHON)) {
    return DAGSTER_VENV_PYTHON;
  }

  return "python3";
}

function copyProcessEnvironment(): Record<string, string> {
  const env = Object.entries(process.env).reduce<Record<string, string>>(
    (nextEnv, [key, value]) => {
      if (typeof value === "string") {
        nextEnv[key] = value;
      }

      return nextEnv;
    },
    {}
  );

  env.MAP_PROJECT_ROOT = PROJECT_ROOT;
  env.PYTHONPATH =
    typeof env.PYTHONPATH === "string" && env.PYTHONPATH.length > 0
      ? `${DAGSTER_SOURCE_ROOT}:${env.PYTHONPATH}`
      : DAGSTER_SOURCE_ROOT;

  if (
    (typeof env.DAGSTER_HOME !== "string" || env.DAGSTER_HOME.trim().length === 0) &&
    existsSync(DAGSTER_HOME_DEFAULT)
  ) {
    env.DAGSTER_HOME = DAGSTER_HOME_DEFAULT;
  }

  return env;
}

function summarizeCommandFailure(stdout: string, stderr: string): string {
  const trimmedStderr = stderr.trim();
  if (trimmedStderr.length > 0) {
    return trimmedStderr;
  }

  const trimmedStdout = stdout.trim();
  if (trimmedStdout.length > 0) {
    return trimmedStdout;
  }

  return "Dagster status command produced no output";
}

export async function getDagsterPipelineStatusSnapshot(dataset: PipelineDataset) {
  const result = await runBufferedCommand({
    command: resolveDagsterPythonBin(),
    args: ["-m", "map_dagster.status", "--dataset", dataset],
    cwd: PROJECT_ROOT,
    env: copyProcessEnvironment(),
  });

  if (result.exitCode !== 0) {
    throw new Error(summarizeCommandFailure(result.stdout, result.stderr));
  }

  const parsed = JSON.parse(result.stdout);
  return ParcelsSyncStatusResponseSchema.parse(parsed);
}
