#!/usr/bin/env bun
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJsonAtomic } from "../packages/ops/src/etl/atomic-file-store";
import { ensureBatchArtifactLayout } from "../packages/ops/src/etl/batch-artifact-layout";
import { findCliArgValue, trimToNull } from "../packages/ops/src/etl/cli-config";
import { runBufferedCommand } from "../packages/ops/src/etl/command-runner";
import { extractCountyPowerPublicUs } from "../packages/ops/src/etl/county-power-public-us";
import {
  buildCountyPowerLoadPayload,
  closeCountyPowerSql,
  createCountyPowerRunId,
  decodeCountyPowerBundleManifest,
  ensureCountyPowerRunDirectories,
  loadCountyPowerPayload,
  materializeCountyPowerManifest,
  normalizeCountyPowerBundle,
  readNormalizedCountyPowerBundle,
  resolveCountyPowerRunContext,
  validateCountyPowerPublicationParity,
  verifyCountyPowerRunConfig,
  writeCountyPowerGoldMarts,
  writeCountyPowerRunConfig,
  writeCountyPowerSilverParquet,
} from "../packages/ops/src/etl/county-power-sync";

type CountyPowerSyncStep = "extract" | "load" | "normalize" | "refresh" | "sync";
type CountyPowerExtractSource = "public-us";

interface StepState {
  readonly dataVersion: string;
  readonly effectiveDate: string;
  readonly month: string;
  readonly runId: string;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_VERSION_DEFAULT = "county-power-v1";

function readOptionalSource(argv: readonly string[]): CountyPowerExtractSource | null {
  const rawSource =
    trimToNull(findCliArgValue(argv, "--source")) ?? trimToNull(process.env.COUNTY_POWER_SOURCE);
  if (rawSource === null) {
    return null;
  }

  if (rawSource === "public-us") {
    return rawSource;
  }

  throw new Error(`Unsupported county power source "${rawSource}"`);
}

function readRequiredStep(argv: readonly string[]): CountyPowerSyncStep {
  const rawStep = trimToNull(findCliArgValue(argv, "--step"));
  if (
    rawStep !== "extract" &&
    rawStep !== "load" &&
    rawStep !== "normalize" &&
    rawStep !== "refresh" &&
    rawStep !== "sync"
  ) {
    throw new Error("Missing required --step=extract|normalize|load|refresh|sync");
  }

  return rawStep;
}

function summarizeCommandFailure(stdout: string, stderr: string): string {
  const stderrText = stderr.trim();
  if (stderrText.length > 0) {
    return stderrText;
  }

  const stdoutText = stdout.trim();
  if (stdoutText.length > 0) {
    return stdoutText;
  }

  return "Command produced no output";
}

async function runProjectCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const commandEnv = Object.entries(env).reduce<Record<string, string>>((result, entry) => {
    const [key, value] = entry;
    if (typeof value === "string") {
      result[key] = value;
    }
    return result;
  }, {});

  const result = await runBufferedCommand({
    args,
    command,
    cwd: PROJECT_ROOT,
    env: commandEnv,
  });

  if (result.exitCode !== 0) {
    throw new Error(summarizeCommandFailure(result.stdout, result.stderr));
  }

  if (result.stdout.trim().length > 0) {
    console.log(result.stdout.trim());
  }
  if (result.stderr.trim().length > 0) {
    console.error(result.stderr.trim());
  }
}

async function extractStep(args: {
  readonly manifestPath: string | null;
  readonly manifestUrl: string | null;
  readonly runId: string;
  readonly source: CountyPowerExtractSource | null;
}): Promise<StepState> {
  const context = resolveCountyPowerRunContext(PROJECT_ROOT, args.runId);
  ensureCountyPowerRunDirectories(context);

  const materialized =
    args.source === "public-us"
      ? await extractCountyPowerPublicUs({
          rawDir: context.rawDir,
          rawManifestPath: context.rawManifestPath,
          runId: args.runId,
        })
      : await materializeCountyPowerManifest({
          ...(args.manifestPath === null ? {} : { manifestPath: args.manifestPath }),
          ...(args.manifestUrl === null ? {} : { manifestUrl: args.manifestUrl }),
          rawDir: context.rawDir,
          rawManifestPath: context.rawManifestPath,
        });
  const manifestInputConfig: {
    manifestPath?: string;
    manifestUrl?: string;
  } = {};
  if (args.source === null && materialized.manifestPath !== null) {
    manifestInputConfig.manifestPath = materialized.manifestPath;
  }
  if (args.source === null && materialized.manifestUrl !== null) {
    manifestInputConfig.manifestUrl = materialized.manifestUrl;
  }

  writeCountyPowerRunConfig(context.runConfigPath, {
    dataVersion: materialized.manifest.dataVersion,
    effectiveDate: materialized.manifest.effectiveDate,
    ...manifestInputConfig,
    month: materialized.manifest.month,
    options: {
      step: "extract",
    },
    runId: args.runId,
  });
  ensureBatchArtifactLayout({
    dataVersion: materialized.manifest.dataVersion,
    effectiveDate: materialized.manifest.effectiveDate,
    layout: context,
    month: materialized.manifest.month,
  });

  writeJsonAtomic(context.runSummaryPath, {
    dataVersion: materialized.manifest.dataVersion,
    effectiveDate: materialized.manifest.effectiveDate,
    manifestInput:
      args.source === null
        ? (materialized.manifestPath ?? materialized.manifestUrl)
        : `source:${args.source}`,
    month: materialized.manifest.month,
    runId: args.runId,
    step: "extract",
  });

  return {
    dataVersion: materialized.manifest.dataVersion,
    effectiveDate: materialized.manifest.effectiveDate,
    month: materialized.manifest.month,
    runId: args.runId,
  };
}

async function normalizeStep(runId: string): Promise<StepState> {
  const context = resolveCountyPowerRunContext(PROJECT_ROOT, runId);
  ensureCountyPowerRunDirectories(context);

  const normalized = normalizeCountyPowerBundle({
    normalizedDir: context.normalizedDir,
    normalizedManifestPath: context.normalizedManifestPath,
    rawManifestPath: context.rawManifestPath,
  });

  verifyCountyPowerRunConfig(context.runConfigPath, {
    dataVersion: normalized.manifest.dataVersion,
    effectiveDate: normalized.manifest.effectiveDate,
    month: normalized.manifest.month,
    options: {
      step: "extract",
    },
    runId,
  });
  const silverArtifacts = await writeCountyPowerSilverParquet({
    bundle: normalized,
    context,
  });

  writeJsonAtomic(context.runSummaryPath, {
    counts: {
      countyFipsAliases: normalized.countyFipsAliases.length,
      countyOperatorRegions: normalized.countyOperatorRegions.length,
      countyOperatorZones: normalized.countyOperatorZones.length,
      congestion: normalized.congestion.length,
      fiber: normalized.fiber.length,
      gas: normalized.gas.length,
      gridFriction: normalized.gridFriction.length,
      operatorRegions: normalized.operatorRegions.length,
      operatorZoneReferences: normalized.operatorZoneReferences.length,
      policyEvents: normalized.policyEvents.length,
      policySnapshots: normalized.policySnapshots.length,
      powerMarketContext: normalized.powerMarketContext.length,
      queueCountyResolutions: normalized.queueCountyResolutions.length,
      queuePoiReferences: normalized.queuePoiReferences.length,
      queueProjects: normalized.queueProjects.length,
      queueResolutionOverrides: normalized.queueResolutionOverrides.length,
      queueSnapshots: normalized.queueSnapshots.length,
      queueUnresolved: normalized.queueUnresolved.length,
      transmission: normalized.transmission.length,
      utilityContext: normalized.utilityContext.length,
    },
    dataVersion: normalized.manifest.dataVersion,
    effectiveDate: normalized.manifest.effectiveDate,
    month: normalized.manifest.month,
    runId,
    silverParquetArtifacts: silverArtifacts.map((artifact) => artifact.relativePath),
    step: "normalize",
  });

  return {
    dataVersion: normalized.manifest.dataVersion,
    effectiveDate: normalized.manifest.effectiveDate,
    month: normalized.manifest.month,
    runId,
  };
}

async function loadStep(runId: string): Promise<StepState> {
  const context = resolveCountyPowerRunContext(PROJECT_ROOT, runId);
  const bundle = await readNormalizedCountyPowerBundle(context.normalizedManifestPath);

  await runProjectCommand("bash", [join(PROJECT_ROOT, "scripts/init-county-scores-schema.sh")]);

  const payload = buildCountyPowerLoadPayload(bundle, {
    modelVersion: trimToNull(process.env.COUNTY_POWER_MODEL_VERSION) ?? MODEL_VERSION_DEFAULT,
    sourcePullTimestamp: bundle.manifest.generatedAt,
  });

  try {
    await loadCountyPowerPayload(payload);
  } finally {
    await closeCountyPowerSql();
  }

  writeJsonAtomic(context.runSummaryPath, {
    counts: {
      countyFipsAliases: payload.countyFipsAliases.length,
      countyOperatorRegions: payload.countyOperatorRegions.length,
      countyOperatorZones: payload.countyOperatorZones.length,
      congestion: payload.congestion.length,
      fiber: payload.fiber.length,
      gas: payload.gas.length,
      gridFriction: payload.gridFriction.length,
      operatorRegions: payload.operatorRegions.length,
      operatorZoneReferences: payload.operatorZoneReferences.length,
      policyEvents: payload.policyEvents.length,
      policySnapshots: payload.policySnapshots.length,
      powerMarketContext: payload.powerMarketContext.length,
      queueCountyResolutions: payload.queueCountyResolutions.length,
      queuePoiReferences: payload.queuePoiReferences.length,
      queueProjects: payload.queueProjects.length,
      queueResolutionOverrides: payload.queueResolutionOverrides.length,
      queueSnapshots: payload.queueSnapshots.length,
      queueUnresolved: payload.queueUnresolved.length,
      transmission: payload.transmission.length,
      utilityContext: payload.utilityContext.length,
    },
    dataVersion: bundle.manifest.dataVersion,
    effectiveDate: bundle.manifest.effectiveDate,
    month: bundle.manifest.month,
    runId,
    step: "load",
  });

  return {
    dataVersion: bundle.manifest.dataVersion,
    effectiveDate: bundle.manifest.effectiveDate,
    month: bundle.manifest.month,
    runId,
  };
}

async function refreshStep(runId: string): Promise<StepState> {
  const context = resolveCountyPowerRunContext(PROJECT_ROOT, runId);
  const manifest = readJson(context.normalizedManifestPath, decodeCountyPowerBundleManifest);
  const countyScoresRunId =
    trimToNull(process.env.COUNTY_SCORES_RUN_ID) ?? `county-market-pressure-${runId}`;
  const refreshEnv: Record<string, string> = {
    ...Object.entries(process.env).reduce<Record<string, string>>((result, entry) => {
      const [key, value] = entry;
      if (typeof value === "string") {
        result[key] = value;
      }
      return result;
    }, {}),
    COUNTY_POWER_RUN_ID: runId,
    COUNTY_SCORES_DATA_VERSION: manifest.dataVersion,
    COUNTY_SCORES_RUN_ID: countyScoresRunId,
  };

  await runProjectCommand(
    "bash",
    [join(PROJECT_ROOT, "scripts/refresh-county-scores.sh")],
    refreshEnv
  );
  const goldArtifacts = await writeCountyPowerGoldMarts({
    context,
    env: refreshEnv,
    manifest,
    publicationRunId: countyScoresRunId,
  });
  const parityValidation = await validateCountyPowerPublicationParity({
    context,
    env: refreshEnv,
    manifest,
    publicationRunId: countyScoresRunId,
  });

  writeJsonAtomic(context.runSummaryPath, {
    countyScoresRunId,
    dataVersion: manifest.dataVersion,
    effectiveDate: manifest.effectiveDate,
    goldParquetArtifacts: goldArtifacts.map((artifact) => artifact.relativePath),
    month: manifest.month,
    parityValidation: {
      failedAssertions: parityValidation.failedAssertions,
      qaAssertionsPath: parityValidation.qaAssertionsPath,
      qaProfilePath: parityValidation.qaProfilePath,
      status: parityValidation.passed ? "passed" : "failed",
      validatedAt: parityValidation.validatedAt,
    },
    runId,
    step: "refresh",
  });
  if (!parityValidation.passed) {
    throw new Error(
      `county power parity validation failed with ${String(parityValidation.failedAssertions)} blocking assertions`
    );
  }
  writeJsonAtomic(context.latestRunPointerPath, {
    dataVersion: manifest.dataVersion,
    effectiveDate: manifest.effectiveDate,
    month: manifest.month,
    runId,
    updatedAt: new Date().toISOString(),
  });

  return {
    dataVersion: manifest.dataVersion,
    effectiveDate: manifest.effectiveDate,
    month: manifest.month,
    runId,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const step = readRequiredStep(argv);
  const runId =
    trimToNull(findCliArgValue(argv, "--run-id")) ?? process.env.RUN_ID ?? createCountyPowerRunId();
  const manifestPath =
    trimToNull(findCliArgValue(argv, "--manifest-path")) ??
    trimToNull(process.env.COUNTY_POWER_MANIFEST_PATH);
  const manifestUrl =
    trimToNull(findCliArgValue(argv, "--manifest-url")) ??
    trimToNull(process.env.COUNTY_POWER_MANIFEST_URL);
  const source = readOptionalSource(argv);

  if (source !== null && (manifestPath !== null || manifestUrl !== null)) {
    throw new Error("Provide either --source or a manifest input, not both");
  }

  if (
    (step === "extract" || step === "sync") &&
    manifestPath === null &&
    manifestUrl === null &&
    source === null
  ) {
    throw new Error("County power sync requires --source, --manifest-path, or --manifest-url");
  }

  let finalState: StepState;
  if (step === "extract") {
    finalState = await extractStep({
      manifestPath,
      manifestUrl,
      runId,
      source,
    });
  } else if (step === "normalize") {
    finalState = await normalizeStep(runId);
  } else if (step === "load") {
    finalState = await loadStep(runId);
  } else if (step === "refresh") {
    finalState = await refreshStep(runId);
  } else {
    await extractStep({
      manifestPath,
      manifestUrl,
      runId,
      source,
    });
    await normalizeStep(runId);
    await loadStep(runId);
    finalState = await refreshStep(runId);
  }

  console.log(
    `[county-power] ${step} complete (run_id=${finalState.runId}, data_version=${finalState.dataVersion}, effective_date=${finalState.effectiveDate})`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[county-power] ERROR: ${message}`);
  process.exit(1);
});
