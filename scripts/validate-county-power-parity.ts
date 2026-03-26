#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readJsonOption } from "../packages/ops/src/etl/atomic-file-store";
import { findCliArgValue, trimToNull } from "../packages/ops/src/etl/cli-config";
import {
  decodeCountyPowerBundleManifest,
  resolveCountyPowerRunContext,
  validateCountyPowerPublicationParity,
} from "../packages/ops/src/etl/county-power-sync";

interface CountyPowerRefreshRunSummary {
  readonly countyScoresRunId: string | null;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseBooleanFlag(value: string | null, defaultValue: boolean): boolean {
  if (value === null) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error(`Expected boolean flag value "true" or "false", received "${value}"`);
}

function decodeCountyPowerRefreshRunSummary(value: unknown): CountyPowerRefreshRunSummary {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected county power run summary to be a JSON object");
  }

  const countyScoresRunId = "countyScoresRunId" in value ? value.countyScoresRunId : undefined;
  if (
    countyScoresRunId !== undefined &&
    countyScoresRunId !== null &&
    typeof countyScoresRunId !== "string"
  ) {
    throw new Error("Expected countyScoresRunId to be a string when present");
  }

  return {
    countyScoresRunId: countyScoresRunId ?? null,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const runId = trimToNull(findCliArgValue(argv, "--run-id")) ?? process.env.RUN_ID;
  if (runId === null) {
    throw new Error("Missing required --run-id");
  }

  const context = resolveCountyPowerRunContext(PROJECT_ROOT, runId);
  const manifest = readJson(context.normalizedManifestPath, decodeCountyPowerBundleManifest);
  const runSummary = readJsonOption(context.runSummaryPath, decodeCountyPowerRefreshRunSummary);
  const publicationRunId =
    trimToNull(findCliArgValue(argv, "--publication-run-id")) ??
    runSummary?.countyScoresRunId ??
    null;
  if (publicationRunId === null) {
    throw new Error(
      "Missing --publication-run-id and countyScoresRunId was not found in run-summary.json"
    );
  }

  const failFast = parseBooleanFlag(trimToNull(findCliArgValue(argv, "--fail-fast")), false);
  const emitQa = parseBooleanFlag(trimToNull(findCliArgValue(argv, "--emit-qa")), true);
  const result = await validateCountyPowerPublicationParity({
    context,
    emitQa,
    env: process.env,
    failFast,
    manifest,
    publicationRunId,
  });

  console.log(
    `[county-power] parity ${result.passed ? "passed" : "failed"} ` +
      `(run_id=${runId}, publication_run_id=${publicationRunId}, failed_assertions=${String(result.failedAssertions)})`
  );

  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[county-power] ERROR: ${message}`);
  process.exit(1);
});
