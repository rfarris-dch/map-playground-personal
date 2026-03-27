#!/usr/bin/env bun
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureDirectory,
  fileExists,
  readJson,
  readJsonOption,
  writeJsonAtomic,
} from "../packages/ops/src/etl/atomic-file-store";
import { findCliArgValue, trimToNull } from "../packages/ops/src/etl/cli-config";
import { runBufferedCommand } from "../packages/ops/src/etl/command-runner";
import {
  decodeCountyPowerBundleManifest,
  decodeCountyPowerRunConfig,
  resolveCountyPowerRunContext,
} from "../packages/ops/src/etl/county-power-sync";
import type {
  CountyPowerBundleManifest,
  CountyPowerRunConfig,
} from "../packages/ops/src/etl/county-power-sync.types";
import {
  closeRunReproducibilitySqlClient,
  getRunReproducibilitySqlClient,
  loadRunReproducibilityEnvFileIfPresent,
  persistRunReproducibilityEnvelope,
  writeRunEnvelopeCopyToDisk,
} from "../packages/ops/src/etl/run-reproducibility";
import type {
  RunArtifactReference,
  RunCodeReference,
  RunEnvelopeRecord,
  RunInputSnapshotRecord,
  RunReplayabilityTier,
  RunReproducibilityKind,
  RunReproducibilityStatus,
  RunSourceSnapshotRecord,
} from "../packages/ops/src/etl/run-reproducibility.types";
import {
  hashCanonicalJson,
  hashFileSha256,
} from "../packages/ops/src/etl/run-reproducibility-hash";
import {
  listSourceIdsByCodeEntrypoint,
  listSourceSnapshotsForRegistryVersion,
  resolveRegistryVersion,
} from "../packages/ops/src/etl/source-registry-read";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADJACENCY_REFRESH_SCRIPT = join(PROJECT_ROOT, "scripts/refresh-county-adjacency.ts");
const GEOMETRY_PREP_SQL = join(PROJECT_ROOT, "scripts/sql/refresh-county-geometry-prep.sql");
const ANALYTICAL_ROLLUP_SQL = join(PROJECT_ROOT, "scripts/sql/refresh-county-scores.sql");
const COUNTY_PUBLIC_US_CODE_ENTRYPOINT = "packages/ops/src/etl/county-power-public-us.impl.js";
const COUNTY_REPRODUCIBILITY_ROOT = join("var", "run-reproducibility", "county");
const REPLAY_PACK_MANIFEST_FILE_NAME = "replay-pack-manifest.json";
const RUN_ENVELOPE_FILE_NAME = "run-envelope.json";
const COUNTY_SCORES_FORMULA_VERSION_DEFAULT = "county-scores-alpha-v1";
const COUNTY_SCORES_METHODOLOGY_ID_DEFAULT = "county-intelligence-alpha-v1";
const COUNTY_OUTPUT_TABLES = [
  "analytics.fact_market_analysis_score_snapshot",
  "analytics.fact_narrative_snapshot",
  "analytics.fact_publication",
  "analytics.fact_county_catchment_snapshot",
  "analytics.county_market_pressure_current",
] as const;
const COUNTY_DOWNSTREAM_OBJECTS = [
  "score/county_market_pressure_primary",
  "score/county_market_pressure_catchment",
  "packet_section/county_market_pressure_summary",
] as const;
const COUNTY_CODE_HASH_PATHS = [
  "scripts/refresh-county-scores.ts",
  "scripts/sql/refresh-county-scores.sql",
  "scripts/sql/refresh-county-geometry-prep.sql",
  "scripts/refresh-county-adjacency.ts",
  "scripts/sql/run-reproducibility-schema.sql",
  "packages/ops/src/etl/run-reproducibility.ts",
  "packages/ops/src/etl/run-reproducibility-hash.ts",
  "packages/ops/src/etl/source-registry-read.ts",
] as const;
const REQUIRED_INTERNAL_SOURCE_IDS = [
  "census-county-adjacency-2025",
  "internal-facility-site",
  "internal-hyperscale-site",
] as const;

interface ReplayPackTableSpec {
  readonly fileName: string;
  readonly importSql: string;
  readonly orderBy: string;
  readonly tableName: string;
}

interface CountyRunOptions {
  readonly countyPowerRunId: string | null;
  readonly dataVersion: string;
  readonly dcPipelineReplayRunId: string | null;
  readonly formulaVersion: string;
  readonly methodologyId: string;
  readonly modelVersion: string;
  readonly registryVersion: string;
  readonly replayedFromRunId: string | null;
  readonly replayPackManifestPath: string | null;
  readonly runId: string;
  readonly runKind: RunReproducibilityKind;
  readonly runRecordedAt: string;
}

interface ReplayPackManifestTableRecord {
  readonly fileHash: string;
  readonly fileName: string;
  readonly importSql: string;
  readonly orderBy: string;
  readonly rowCount: number;
  readonly tableName: string;
}

interface ReplayPackManifest {
  readonly exportedAt: string;
  readonly tables: readonly ReplayPackManifestTableRecord[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const REPLAY_PACK_TABLES: readonly ReplayPackTableSpec[] = [
  {
    fileName: "analytics-dim-county.csv",
    importSql:
      "TRUNCATE TABLE analytics.dim_county; \\copy analytics.dim_county FROM '__FILE__' CSV HEADER",
    orderBy: "county_geoid",
    tableName: "analytics.dim_county",
  },
  {
    fileName: "analytics-bridge-county-market.csv",
    importSql:
      "TRUNCATE TABLE analytics.bridge_county_market; \\copy analytics.bridge_county_market FROM '__FILE__' CSV HEADER",
    orderBy: "county_geoid, market_id",
    tableName: "analytics.bridge_county_market",
  },
  {
    fileName: "analytics-bridge-county-operator-region.csv",
    importSql:
      "TRUNCATE TABLE analytics.bridge_county_operator_region; \\copy analytics.bridge_county_operator_region FROM '__FILE__' CSV HEADER",
    orderBy: "county_geoid, operator_region",
    tableName: "analytics.bridge_county_operator_region",
  },
  {
    fileName: "analytics-bridge-county-adjacency.csv",
    importSql:
      "TRUNCATE TABLE analytics.bridge_county_adjacency; \\copy analytics.bridge_county_adjacency FROM '__FILE__' CSV HEADER",
    orderBy: "county_geoid, adjacent_county_geoid",
    tableName: "analytics.bridge_county_adjacency",
  },
];

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
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

function quotePsqlMetaPath(path: string): string {
  return `'${path.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function copyProcessEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.entries(env).reduce<Record<string, string>>((result, entry) => {
    const [key, value] = entry;
    if (typeof value === "string") {
      result[key] = value;
    }
    return result;
  }, {});
}

function readIsoDate(value: string, label: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) {
    throw new Error(`Expected ISO date for ${label}`);
  }

  return trimmed;
}

function readIsoTimestamp(value: string, label: string): string {
  const trimmed = value.trim();
  if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) {
    throw new Error(`Expected UTC ISO timestamp for ${label}`);
  }

  return trimmed;
}

function decodeReplayPackManifestTableRecord(entry: unknown): ReplayPackManifestTableRecord {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error("Invalid replay pack manifest table");
  }

  const fileHash =
    typeof entry.fileHash === "string" && entry.fileHash.trim().length > 0
      ? entry.fileHash
      : (() => {
          throw new Error("Missing replay pack manifest table fileHash");
        })();
  const fileName =
    typeof entry.fileName === "string" && entry.fileName.trim().length > 0
      ? entry.fileName
      : (() => {
          throw new Error("Missing replay pack manifest table fileName");
        })();
  const importSql =
    typeof entry.importSql === "string" && entry.importSql.trim().length > 0
      ? entry.importSql
      : (() => {
          throw new Error("Missing replay pack manifest table importSql");
        })();
  const orderBy =
    typeof entry.orderBy === "string" && entry.orderBy.trim().length > 0
      ? entry.orderBy
      : (() => {
          throw new Error("Missing replay pack manifest table orderBy");
        })();
  const rowCount =
    typeof entry.rowCount === "number" && Number.isInteger(entry.rowCount) && entry.rowCount >= 0
      ? entry.rowCount
      : (() => {
          throw new Error("Missing replay pack manifest table rowCount");
        })();
  const tableName =
    typeof entry.tableName === "string" && entry.tableName.trim().length > 0
      ? entry.tableName
      : (() => {
          throw new Error("Missing replay pack manifest table tableName");
        })();

  return {
    fileHash,
    fileName,
    importSql,
    orderBy,
    rowCount,
    tableName,
  };
}

function decodeReplayPackManifest(value: unknown): ReplayPackManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected replay pack manifest object");
  }

  const exportedAt =
    typeof value.exportedAt === "string" && value.exportedAt.trim().length > 0
      ? value.exportedAt
      : (() => {
          throw new Error("Missing replay pack manifest exportedAt");
        })();
  const rawTables = value.tables;
  if (!Array.isArray(rawTables)) {
    throw new Error("Missing replay pack manifest tables");
  }

  return {
    exportedAt,
    tables: rawTables.map(decodeReplayPackManifestTableRecord),
  };
}

function resolveRunId(argv: readonly string[]): string {
  const cliValue = trimToNull(findCliArgValue(argv, "--run-id"));
  if (cliValue !== null) {
    return cliValue;
  }

  const envValue = trimToNull(process.env.COUNTY_SCORES_RUN_ID);
  if (envValue !== null) {
    return envValue;
  }

  return `county-scores-${new Date().toISOString().replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`;
}

function resolveRunOptions(
  argv: readonly string[],
  manifest: CountyPowerBundleManifest | null
): CountyRunOptions {
  const runRecordedAt = readIsoTimestamp(
    trimToNull(findCliArgValue(argv, "--run-recorded-at")) ??
      trimToNull(process.env.COUNTY_SCORES_RUN_RECORDED_AT) ??
      new Date().toISOString(),
    "run_recorded_at"
  );
  const dataVersion = readIsoDate(
    trimToNull(findCliArgValue(argv, "--data-version")) ??
      trimToNull(process.env.COUNTY_SCORES_DATA_VERSION) ??
      trimToNull(manifest?.dataVersion) ??
      new Date().toISOString().slice(0, 10),
    "data_version"
  );
  const formulaVersion =
    trimToNull(findCliArgValue(argv, "--formula-version")) ??
    trimToNull(process.env.COUNTY_SCORES_FORMULA_VERSION) ??
    COUNTY_SCORES_FORMULA_VERSION_DEFAULT;
  const modelVersion =
    trimToNull(findCliArgValue(argv, "--model-version")) ??
    trimToNull(process.env.COUNTY_SCORES_MODEL_VERSION) ??
    formulaVersion;
  const methodologyId =
    trimToNull(findCliArgValue(argv, "--methodology-id")) ??
    trimToNull(process.env.COUNTY_SCORES_METHODOLOGY_ID) ??
    COUNTY_SCORES_METHODOLOGY_ID_DEFAULT;
  const countyPowerRunId =
    trimToNull(findCliArgValue(argv, "--county-power-run-id")) ??
    trimToNull(process.env.COUNTY_POWER_RUN_ID);
  const dcPipelineReplayRunId =
    trimToNull(findCliArgValue(argv, "--dc-pipeline-replay-run-id")) ??
    trimToNull(process.env.COUNTY_SCORES_DC_PIPELINE_REPLAY_RUN_ID);
  const replayPackManifestPath =
    trimToNull(findCliArgValue(argv, "--replay-pack-manifest-path")) ??
    trimToNull(process.env.COUNTY_SCORES_REPLAY_PACK_MANIFEST_PATH);
  const rawRunKind =
    trimToNull(findCliArgValue(argv, "--run-kind")) ??
    trimToNull(process.env.COUNTY_SCORES_RUN_KIND) ??
    "publication";
  if (rawRunKind !== "publication" && rawRunKind !== "analysis" && rawRunKind !== "replay") {
    throw new Error(`Unsupported county scores run kind "${rawRunKind}"`);
  }
  const replayedFromRunId =
    trimToNull(findCliArgValue(argv, "--replayed-from-run-id")) ??
    trimToNull(process.env.COUNTY_SCORES_REPLAYED_FROM_RUN_ID);

  return {
    countyPowerRunId,
    dataVersion,
    dcPipelineReplayRunId,
    formulaVersion,
    methodologyId,
    modelVersion,
    replayPackManifestPath,
    replayedFromRunId,
    registryVersion: "",
    runId: resolveRunId(argv),
    runKind: rawRunKind,
    runRecordedAt,
  };
}

async function runProjectCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv
): Promise<string> {
  const result = await runBufferedCommand({
    args: [...args],
    command,
    cwd: PROJECT_ROOT,
    env: copyProcessEnvironment(env),
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  return result.stdout.trim();
}

async function runPsqlFile(
  databaseUrl: string,
  filePath: string,
  variables: Readonly<Record<string, string>>,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const args = [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1"];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-v", `${key}=${value}`);
  }
  args.push("-f", filePath);

  await runProjectCommand("psql", args, env);
}

async function runPsqlScalar(
  databaseUrl: string,
  sql: string,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const output = await runProjectCommand(
    "psql",
    [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql],
    env
  );
  return output.trim();
}

async function readGitMetadata(env: NodeJS.ProcessEnv): Promise<Record<string, unknown>> {
  const commitSha = await runProjectCommand("git", ["rev-parse", "HEAD"], env).catch(() => "");
  const dirtyStatus = await runProjectCommand("git", ["status", "--short"], env).catch(() => "");

  return {
    gitCommitSha: trimToNull(commitSha),
    workspaceDirty: dirtyStatus.trim().length > 0,
  };
}

async function buildCodeReferences(env: NodeJS.ProcessEnv): Promise<readonly RunCodeReference[]> {
  const references: RunCodeReference[] = [];

  for (const relativePath of COUNTY_CODE_HASH_PATHS) {
    const absolutePath = join(PROJECT_ROOT, relativePath);
    if (!fileExists(absolutePath)) {
      throw new Error(`Missing code artifact for county reproducibility hash: ${relativePath}`);
    }

    references.push({
      fileHash: await hashFileSha256(absolutePath),
      filePath: absolutePath,
      relativePath,
    });
  }

  const gitMetadata = await readGitMetadata(env);
  const gitMetadataHash = hashCanonicalJson(gitMetadata);
  references.push({
    fileHash: gitMetadataHash,
    filePath: "git",
    relativePath: "git",
  });

  return references;
}

function buildCodeHash(references: readonly RunCodeReference[]): string {
  return hashCanonicalJson(
    references.map((reference) => ({
      fileHash: reference.fileHash,
      relativePath: reference.relativePath,
    }))
  );
}

function buildCountyRunDirectory(runId: string): string {
  return resolve(PROJECT_ROOT, COUNTY_REPRODUCIBILITY_ROOT, runId);
}

async function exportReplayPack(
  databaseUrl: string,
  runRoot: string,
  env: NodeJS.ProcessEnv
): Promise<{
  readonly inputSnapshot: RunInputSnapshotRecord;
  readonly manifest: ReplayPackManifest;
  readonly manifestPath: string;
}> {
  const replayPackDir = join(runRoot, "replay-pack");
  ensureDirectory(replayPackDir);

  const tables: ReplayPackManifestTableRecord[] = [];
  for (const table of REPLAY_PACK_TABLES) {
    const outputPath = join(replayPackDir, table.fileName);
    const copyCommand = `\\copy (SELECT * FROM ${table.tableName} ORDER BY ${table.orderBy}) TO ${quotePsqlMetaPath(outputPath)} CSV HEADER`;
    await runProjectCommand(
      "psql",
      [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-c", copyCommand],
      env
    );
    const rowCountText = await runPsqlScalar(
      databaseUrl,
      `SELECT COUNT(*)::text FROM ${table.tableName};`,
      env
    );
    const fileHash = await hashFileSha256(outputPath);
    tables.push({
      fileHash,
      fileName: table.fileName,
      importSql: table.importSql,
      orderBy: table.orderBy,
      rowCount: Number.parseInt(rowCountText, 10),
      tableName: table.tableName,
    });
  }

  const manifest: ReplayPackManifest = {
    exportedAt: new Date().toISOString(),
    tables,
  };
  const manifestPath = join(replayPackDir, REPLAY_PACK_MANIFEST_FILE_NAME);
  writeJsonAtomic(manifestPath, manifest);

  return {
    inputSnapshot: {
      dataVersion: null,
      detailsJson: {
        tableCount: tables.length,
        tables: tables.map((table) => ({
          fileHash: table.fileHash,
          fileName: table.fileName,
          rowCount: table.rowCount,
          tableName: table.tableName,
        })),
      },
      effectiveDate: null,
      manifestHash: await hashFileSha256(manifestPath),
      manifestPath,
      replayMode: "strict_input",
      snapshotId: "county-replay-pack",
      snapshotKind: "boundary_replay_pack",
      sourceId: null,
      sourceVersionId: null,
      storageUri: relative(PROJECT_ROOT, replayPackDir),
    },
    manifest,
    manifestPath,
  };
}

async function importReplayPack(
  databaseUrl: string,
  manifestPath: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const manifest = readJson(manifestPath, decodeReplayPackManifest);
  const importDir = mkdtempSync(join(tmpdir(), "county-replay-import-"));
  try {
    for (const table of manifest.tables) {
      const filePath = join(dirname(manifestPath), table.fileName);
      if (!fileExists(filePath)) {
        throw new Error(`Replay pack file not found: ${filePath}`);
      }

      const importScriptPath = join(importDir, `${table.tableName.replaceAll(".", "-")}.sql`);
      writeFileSync(
        importScriptPath,
        `${table.importSql.replace("__FILE__", filePath.replaceAll("'", "''"))}\n`,
        "utf8"
      );
      try {
        await runProjectCommand(
          "psql",
          [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", importScriptPath],
          env
        );
      } finally {
        rmSync(importScriptPath, { force: true });
      }
    }
  } finally {
    rmSync(importDir, { force: true, recursive: true });
  }
}

async function buildCountyPowerInputSnapshot(
  countyPowerRunId: string | null,
  manifest: CountyPowerBundleManifest | null,
  runConfig: CountyPowerRunConfig | null
): Promise<RunInputSnapshotRecord | null> {
  if (countyPowerRunId === null) {
    return null;
  }

  const context = resolveCountyPowerRunContext(PROJECT_ROOT, countyPowerRunId);
  const manifestPath = context.normalizedManifestPath;
  if (!fileExists(manifestPath)) {
    throw new Error(`County power normalized manifest not found for run ${countyPowerRunId}`);
  }

  const lakeManifestPath = context.lakeManifestPath;
  const runSummaryPath = context.runSummaryPath;
  const runConfigPath = context.runConfigPath;
  const manifestHash = await hashFileSha256(manifestPath);

  return {
    dataVersion: manifest?.dataVersion ?? runConfig?.dataVersion ?? null,
    detailsJson: {
      countyPowerRunConfigPath: fileExists(runConfigPath) ? runConfigPath : null,
      countyPowerRunSummaryPath: fileExists(runSummaryPath) ? runSummaryPath : null,
      lakeManifestPath: fileExists(lakeManifestPath) ? lakeManifestPath : null,
      options: runConfig?.options ?? {},
    },
    effectiveDate: manifest?.effectiveDate ?? runConfig?.effectiveDate ?? null,
    manifestHash,
    manifestPath,
    replayMode: "strict_input",
    snapshotId: countyPowerRunId,
    snapshotKind: "county_power_run",
    sourceId: null,
    sourceVersionId: null,
    storageUri: relative(PROJECT_ROOT, context.runDir),
  };
}

function buildSelfSnapshotInput(runId: string, dataVersion: string): RunInputSnapshotRecord {
  return {
    dataVersion,
    detailsJson: {
      outputTable: "analytics.fact_dc_pipeline_snapshot",
      publicationRunId: runId,
    },
    effectiveDate: dataVersion,
    manifestHash: null,
    manifestPath: null,
    replayMode: "self_snapshot",
    snapshotId: runId,
    snapshotKind: "dc_pipeline_self_snapshot",
    sourceId: null,
    sourceVersionId: null,
    storageUri: null,
  };
}

async function buildArtifactReferences(
  envelopePath: string,
  replayPackManifestPath: string | null,
  countyPowerManifestPath: string | null
): Promise<readonly RunArtifactReference[]> {
  const references: RunArtifactReference[] = [];

  const artifactCandidates = [
    { artifactKind: "run-envelope", filePath: envelopePath },
    replayPackManifestPath === null
      ? null
      : { artifactKind: "replay-pack-manifest", filePath: replayPackManifestPath },
    countyPowerManifestPath === null
      ? null
      : { artifactKind: "county-power-manifest", filePath: countyPowerManifestPath },
  ];

  for (const candidate of artifactCandidates) {
    if (candidate === null || !fileExists(candidate.filePath)) {
      continue;
    }

    references.push({
      artifactKind: candidate.artifactKind,
      fileHash: await hashFileSha256(candidate.filePath),
      filePath: candidate.filePath,
      relativePath: relative(PROJECT_ROOT, candidate.filePath),
    });
  }

  return references;
}

async function buildOutputPayload(runId: string): Promise<Record<string, unknown>> {
  const sql = getRunReproducibilitySqlClient();
  const scoreRows = await sql
    .unsafe<readonly Record<string, unknown>[]>(
      `SELECT to_jsonb(snapshot) - ARRAY['publication_run_id', 'created_at'] AS row_json
FROM (
  SELECT *
  FROM analytics.fact_market_analysis_score_snapshot
  WHERE publication_run_id = $1
  ORDER BY county_geoid
) AS snapshot`,
      [runId]
    )
    .execute();
  const narrativeRows = await sql
    .unsafe<readonly Record<string, unknown>[]>(
      `SELECT to_jsonb(snapshot) - ARRAY['publication_run_id', 'created_at'] AS row_json
FROM (
  SELECT *
  FROM analytics.fact_narrative_snapshot
  WHERE publication_run_id = $1
  ORDER BY county_geoid
) AS snapshot`,
      [runId]
    )
    .execute();
  const catchmentRows = await sql
    .unsafe<readonly Record<string, unknown>[]>(
      `SELECT to_jsonb(snapshot) - ARRAY['publication_run_id', 'created_at'] AS row_json
FROM (
  SELECT *
  FROM analytics.fact_county_catchment_snapshot
  WHERE publication_run_id = $1
  ORDER BY county_geoid
) AS snapshot`,
      [runId]
    )
    .execute();

  return {
    catchment: catchmentRows.map((row) => row.row_json),
    narratives: narrativeRows.map((row) => row.row_json),
    scores: scoreRows.map((row) => row.row_json),
  };
}

async function readOutputCounts(runId: string): Promise<Record<string, unknown>> {
  const sql = getRunReproducibilitySqlClient();
  const rows = await sql
    .unsafe<readonly Record<string, unknown>[]>(
      `SELECT
  (SELECT COUNT(*)::integer FROM analytics.fact_market_analysis_score_snapshot WHERE publication_run_id = $1) AS score_snapshot_count,
  (SELECT COUNT(*)::integer FROM analytics.fact_narrative_snapshot WHERE publication_run_id = $1) AS narrative_snapshot_count,
  (SELECT COUNT(*)::integer FROM analytics.fact_county_catchment_snapshot WHERE publication_run_id = $1) AS catchment_snapshot_count,
  (SELECT COUNT(*)::integer FROM analytics.fact_publication WHERE publication_run_id = $1) AS publication_count,
  (SELECT COUNT(*)::integer FROM analytics.county_market_pressure_current) AS current_count`,
      [runId]
    )
    .execute();

  const firstRow = rows[0];
  if (firstRow === undefined) {
    return {};
  }

  return Object.entries(firstRow).reduce<Record<string, unknown>>((result, entry) => {
    const [key, value] = entry;
    result[key] = value;
    return result;
  }, {});
}

function buildConfigHash(configJson: Record<string, unknown>): string {
  return hashCanonicalJson(configJson);
}

function buildInputStateHash(
  sourceSnapshots: readonly RunSourceSnapshotRecord[],
  inputSnapshots: readonly RunInputSnapshotRecord[]
): string {
  return hashCanonicalJson({
    ingestionSnapshotIds: inputSnapshots
      .map((snapshot) => snapshot.snapshotId)
      .sort((left, right) => left.localeCompare(right)),
    runtimeStateHashes: sourceSnapshots
      .map((snapshot) => snapshot.runtimeStateHash)
      .sort((left, right) => left.localeCompare(right)),
    sourceVersionIds: sourceSnapshots
      .flatMap((snapshot) => (snapshot.sourceVersionId === null ? [] : [snapshot.sourceVersionId]))
      .sort((left, right) => left.localeCompare(right)),
  });
}

function buildReplayabilityTier(
  countyPowerInput: RunInputSnapshotRecord | null,
  replayPackInput: RunInputSnapshotRecord | null,
  sourceSnapshots: readonly RunSourceSnapshotRecord[]
): RunReplayabilityTier {
  const hasCountyPowerInput = countyPowerInput !== null;
  const hasReplayPack = replayPackInput !== null;
  const hasRuntimeSnapshots = sourceSnapshots.length > 0;

  if (hasCountyPowerInput && hasReplayPack && hasRuntimeSnapshots) {
    return "strict";
  }

  if (hasCountyPowerInput || hasRuntimeSnapshots) {
    return "best_effort";
  }

  return "not_replayable";
}

function buildEnvelopeHash(envelope: RunEnvelopeRecord): string {
  return hashCanonicalJson({
    codeHash: envelope.codeHash,
    configHash: envelope.configHash,
    dataVersion: envelope.dataVersion,
    downstreamObjectsJson: envelope.downstreamObjectsJson,
    effectiveDate: envelope.effectiveDate,
    envelopeVersion: envelope.envelopeVersion,
    formulaVersion: envelope.formulaVersion,
    ingestionSnapshotIdsJson: envelope.ingestionSnapshotIdsJson,
    inputStateHash: envelope.inputStateHash,
    methodologyId: envelope.methodologyId,
    modelVersion: envelope.modelVersion,
    month: envelope.month,
    outputCountsJson: envelope.outputCountsJson,
    outputHash: envelope.outputHash,
    outputTablesJson: envelope.outputTablesJson,
    registryVersion: envelope.registryVersion,
    replayabilityTier: envelope.replayabilityTier,
    replayedFromRunId: envelope.replayedFromRunId,
    runId: envelope.runId,
    runKind: envelope.runKind,
    runRecordedAt: envelope.runRecordedAt,
    sourceVersionIdsJson: envelope.sourceVersionIdsJson,
    status: envelope.status,
    surfaceScope: envelope.surfaceScope,
  });
}

function collectUniqueSourceIds(
  upstreamSourceIds: readonly string[],
  internalSourceIds: readonly string[]
): readonly string[] {
  return [...new Set([...upstreamSourceIds, ...internalSourceIds])].sort((left, right) =>
    left.localeCompare(right)
  );
}

async function buildCountySourceSnapshots(
  registryVersion: string
): Promise<readonly RunSourceSnapshotRecord[]> {
  const upstreamSourceIds = await listSourceIdsByCodeEntrypoint(
    registryVersion,
    COUNTY_PUBLIC_US_CODE_ENTRYPOINT
  );
  const sourceIds = collectUniqueSourceIds(upstreamSourceIds, REQUIRED_INTERNAL_SOURCE_IDS);
  const sourceSnapshots = await listSourceSnapshotsForRegistryVersion(registryVersion, sourceIds);

  const missingSourceIds = sourceIds.filter(
    (sourceId) => !sourceSnapshots.some((snapshot) => snapshot.sourceId === sourceId)
  );
  if (missingSourceIds.length > 0) {
    throw new Error(
      `Missing reproducibility source snapshots for county run: ${missingSourceIds.join(", ")}`
    );
  }

  return sourceSnapshots;
}

function buildCountyConfigJson(
  options: CountyRunOptions,
  manifest: CountyPowerBundleManifest | null,
  runConfig: CountyPowerRunConfig | null
): Record<string, unknown> {
  return {
    countyPowerRunId: options.countyPowerRunId,
    dataVersion: options.dataVersion,
    dcPipelineReplayRunId: options.dcPipelineReplayRunId,
    effectiveDate: manifest?.effectiveDate ?? runConfig?.effectiveDate ?? options.dataVersion,
    formulaVersion: options.formulaVersion,
    methodologyId: options.methodologyId,
    modelVersion: options.modelVersion,
    month: manifest?.month ?? runConfig?.month ?? null,
    registryVersion: options.registryVersion,
    replayedFromRunId: options.replayedFromRunId,
    runKind: options.runKind,
    runRecordedAt: options.runRecordedAt,
    surfaceScope: "county",
    upstreamOptions: runConfig?.options ?? {},
  };
}

async function buildCountyEnvelopeArtifacts(
  options: CountyRunOptions,
  manifest: CountyPowerBundleManifest | null,
  runConfig: CountyPowerRunConfig | null,
  runRoot: string,
  status: RunReproducibilityStatus,
  sourceSnapshots: readonly RunSourceSnapshotRecord[],
  inputSnapshots: readonly RunInputSnapshotRecord[],
  outputHash: string | null
): Promise<RunEnvelopeRecord> {
  const codeRefsJson = await buildCodeReferences(process.env);
  const configJson = buildCountyConfigJson(options, manifest, runConfig);
  const configHash = buildConfigHash(configJson);
  const codeHash = buildCodeHash(codeRefsJson);
  const outputCountsJson = outputHash === null ? {} : await readOutputCounts(options.runId);
  const sourceVersionIdsJson = sourceSnapshots
    .flatMap((snapshot) => (snapshot.sourceVersionId === null ? [] : [snapshot.sourceVersionId]))
    .sort((left, right) => left.localeCompare(right));
  const ingestionSnapshotIdsJson = inputSnapshots
    .map((snapshot) => snapshot.snapshotId)
    .sort((left, right) => left.localeCompare(right));
  const inputStateHash = buildInputStateHash(sourceSnapshots, inputSnapshots);
  const envelopePath = join(runRoot, RUN_ENVELOPE_FILE_NAME);
  const replayPackSnapshot = inputSnapshots.find(
    (snapshot) => snapshot.snapshotKind === "boundary_replay_pack"
  );
  const countyPowerSnapshot = inputSnapshots.find(
    (snapshot) => snapshot.snapshotKind === "county_power_run"
  );
  const artifactRefsJson = await buildArtifactReferences(
    envelopePath,
    replayPackSnapshot?.manifestPath ?? null,
    countyPowerSnapshot?.manifestPath ?? null
  );
  const replayabilityTier = buildReplayabilityTier(
    countyPowerSnapshot ?? null,
    replayPackSnapshot ?? null,
    sourceSnapshots
  );

  const baseEnvelope: RunEnvelopeRecord = {
    artifactRefsJson,
    codeHash,
    codeRefsJson,
    configHash,
    configJson,
    createdAt: null,
    dataVersion: options.dataVersion,
    downstreamObjectsJson: [...COUNTY_DOWNSTREAM_OBJECTS],
    effectiveDate: manifest?.effectiveDate ?? runConfig?.effectiveDate ?? options.dataVersion,
    envelopeHash: "",
    envelopeVersion: "run-envelope-v1",
    formulaVersion: options.formulaVersion,
    ingestionSnapshotIdsJson,
    inputStateHash,
    methodologyId: options.methodologyId,
    modelVersion: options.modelVersion,
    month: manifest?.month ?? runConfig?.month ?? null,
    notesJson: {
      countyPowerRunId: options.countyPowerRunId,
    },
    outputCountsJson,
    outputHash,
    outputTablesJson: [...COUNTY_OUTPUT_TABLES],
    registryVersion: options.registryVersion,
    replayabilityTier,
    replayedFromRunId: options.replayedFromRunId,
    runId: options.runId,
    runKind: options.runKind,
    runRecordedAt: options.runRecordedAt,
    sourceVersionIdsJson,
    status,
    surfaceScope: "county",
    updatedAt: null,
  };

  return {
    ...baseEnvelope,
    envelopeHash: buildEnvelopeHash(baseEnvelope),
  };
}

async function computeOutputHash(runId: string): Promise<string> {
  return hashCanonicalJson(await buildOutputPayload(runId));
}

async function clearExistingCountyRunOutputs(runId: string): Promise<void> {
  const sql = getRunReproducibilitySqlClient();
  await sql.begin("read write", async (client) => {
    await client`
      DELETE FROM analytics.fact_narrative_snapshot
      WHERE publication_run_id = ${runId}
    `.execute();
    await client`
      DELETE FROM analytics.fact_county_catchment_snapshot
      WHERE publication_run_id = ${runId}
    `.execute();
    await client`
      DELETE FROM analytics.fact_market_analysis_score_snapshot
      WHERE publication_run_id = ${runId}
    `.execute();
    await client`
      DELETE FROM analytics.fact_publication
      WHERE publication_run_id = ${runId}
    `.execute();
  });
}

async function refreshCountyScores(
  options: CountyRunOptions,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const databaseUrl = resolveDatabaseUrl(env);
  await runProjectCommand(
    "bash",
    [join(PROJECT_ROOT, "scripts/init-county-scores-schema.sh")],
    env
  );
  if (options.replayPackManifestPath === null) {
    await runProjectCommand("bun", ["run", ADJACENCY_REFRESH_SCRIPT], env);
    await runPsqlFile(
      databaseUrl,
      GEOMETRY_PREP_SQL,
      {
        data_version: options.dataVersion,
        formula_version: options.formulaVersion,
      },
      env
    );
  } else {
    await importReplayPack(databaseUrl, options.replayPackManifestPath, env);
  }
  await clearExistingCountyRunOutputs(options.runId);
  await runPsqlFile(
    databaseUrl,
    ANALYTICAL_ROLLUP_SQL,
    {
      data_version: options.dataVersion,
      formula_version: options.formulaVersion,
      methodology_id: options.methodologyId,
      model_version: options.modelVersion,
      registry_version: options.registryVersion,
      run_id: options.runId,
      run_recorded_at: options.runRecordedAt,
      dc_pipeline_replay_run_id: options.dcPipelineReplayRunId ?? "",
    },
    env
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const env = copyProcessEnvironment(process.env);
  await loadRunReproducibilityEnvFileIfPresent(PROJECT_ROOT, env);
  resolveDatabaseUrl(env);

  if (env.DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env.POSTGRES_URL !== undefined) {
    process.env.POSTGRES_URL = env.POSTGRES_URL;
  }

  const initialCountyPowerRunId =
    trimToNull(findCliArgValue(argv, "--county-power-run-id")) ??
    trimToNull(env.COUNTY_POWER_RUN_ID);
  const countyPowerContext =
    initialCountyPowerRunId === null
      ? null
      : resolveCountyPowerRunContext(PROJECT_ROOT, initialCountyPowerRunId);
  const countyPowerManifest =
    countyPowerContext === null
      ? null
      : readJson(countyPowerContext.normalizedManifestPath, decodeCountyPowerBundleManifest);
  const countyPowerRunConfig =
    countyPowerContext === null
      ? null
      : readJsonOption(countyPowerContext.runConfigPath, decodeCountyPowerRunConfig);
  const baseRunOptions = resolveRunOptions(argv, countyPowerManifest);
  const runOptions: CountyRunOptions = {
    ...baseRunOptions,
    registryVersion: await resolveRegistryVersion(
      trimToNull(findCliArgValue(argv, "--registry-version")) ??
        trimToNull(env.COUNTY_SCORES_REGISTRY_VERSION),
      getRunReproducibilitySqlClient(env)
    ),
  };

  const runRoot = buildCountyRunDirectory(runOptions.runId);
  ensureDirectory(runRoot);

  const sourceSnapshots = await buildCountySourceSnapshots(runOptions.registryVersion);
  const countyPowerInputSnapshot = await buildCountyPowerInputSnapshot(
    runOptions.countyPowerRunId,
    countyPowerManifest,
    countyPowerRunConfig
  );

  let inputSnapshots: readonly RunInputSnapshotRecord[] = [];
  let outputHash: string | null = null;
  let status: RunReproducibilityStatus = "failed";

  try {
    try {
      const replayPack = await exportReplayPack(resolveDatabaseUrl(env), runRoot, env);
      inputSnapshots = [
        ...(countyPowerInputSnapshot === null ? [] : [countyPowerInputSnapshot]),
        buildSelfSnapshotInput(runOptions.runId, runOptions.dataVersion),
        replayPack.inputSnapshot,
      ];

      await refreshCountyScores(runOptions, env);
      outputHash = await computeOutputHash(runOptions.runId);
      status = "completed";
    } catch (error) {
      const failureEnvelope = await buildCountyEnvelopeArtifacts(
        runOptions,
        countyPowerManifest,
        countyPowerRunConfig,
        runRoot,
        status,
        sourceSnapshots,
        inputSnapshots,
        outputHash
      );
      await persistRunReproducibilityEnvelope({
        envelope: failureEnvelope,
        inputSnapshots,
        sourceSnapshots,
      });
      await writeRunEnvelopeCopyToDisk(join(runRoot, RUN_ENVELOPE_FILE_NAME), {
        envelope: failureEnvelope,
        inputSnapshots,
        sourceSnapshots,
      });
      throw error;
    }

    const envelope = await buildCountyEnvelopeArtifacts(
      runOptions,
      countyPowerManifest,
      countyPowerRunConfig,
      runRoot,
      status,
      sourceSnapshots,
      inputSnapshots,
      outputHash
    );
    await persistRunReproducibilityEnvelope({
      envelope,
      inputSnapshots,
      sourceSnapshots,
    });
    await writeRunEnvelopeCopyToDisk(join(runRoot, RUN_ENVELOPE_FILE_NAME), {
      envelope,
      inputSnapshots,
      sourceSnapshots,
    });
    writeJsonAtomic(join(runRoot, "summary.json"), {
      configHash: envelope.configHash,
      envelopeHash: envelope.envelopeHash,
      outputHash: envelope.outputHash,
      registryVersion: envelope.registryVersion,
      replayabilityTier: envelope.replayabilityTier,
      runId: envelope.runId,
      status: envelope.status,
    });

    console.log(
      `[county-scores] refreshed run ${runOptions.runId} (registry_version=${runOptions.registryVersion}, replayability_tier=${envelope.replayabilityTier})`
    );
  } finally {
    await closeRunReproducibilitySqlClient();
  }
}

main().catch((error) => {
  console.error("[county-scores] refresh failed", error);
  process.exit(1);
});
