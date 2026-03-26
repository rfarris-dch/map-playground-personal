#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBufferedCommand } from "../packages/ops/src/etl/command-runner";
import { refreshCountyAdjacency } from "../packages/ops/src/etl/county-adjacency";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COUNTY_ADJACENCY_SCHEMA_SQL = resolve(
  PROJECT_ROOT,
  "scripts/sql/county-adjacency-schema.sql"
);

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
}

function copyProcessEnvironment(
  envSource: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  return Object.entries(envSource).reduce<Record<string, string>>((next, [key, value]) => {
    if (typeof value === "string") {
      next[key] = value;
    }

    return next;
  }, {});
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

  return "Command produced no output";
}

async function ensureCountyAdjacencySchema(env: NodeJS.ProcessEnv): Promise<void> {
  const result = await runBufferedCommand({
    args: [
      resolveDatabaseUrl(env),
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      COUNTY_ADJACENCY_SCHEMA_SQL,
    ],
    command: "psql",
    cwd: PROJECT_ROOT,
    env: copyProcessEnvironment(env),
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `county adjacency schema init failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }
}

async function main(): Promise<void> {
  await ensureCountyAdjacencySchema(process.env);

  const result = await refreshCountyAdjacency({
    projectRoot: PROJECT_ROOT,
  });

  console.log(
    `[county-adjacency] complete (run_id=${result.runId}, boundary_version=${result.boundaryVersion}, built_artifact=${String(result.builtArtifact)}, published_to_postgres=${String(result.publishedToPostgres)})`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[county-adjacency] ERROR: ${message}`);
  process.exit(1);
});
