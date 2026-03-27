#!/usr/bin/env bun
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureDirectory,
  fileExists,
  readJson,
  writeJsonAtomic,
} from "../packages/ops/src/etl/atomic-file-store";
import { findCliArgValue, trimToNull } from "../packages/ops/src/etl/cli-config";
import { runBufferedCommand } from "../packages/ops/src/etl/command-runner";
import {
  closeRunReproducibilitySqlClient,
  getRunReproducibilitySqlClient,
  loadRunReproducibilityEnvelope,
  loadRunReproducibilityEnvFileIfPresent,
  persistRunReproducibilityEnvelope,
} from "../packages/ops/src/etl/run-reproducibility";
import type {
  LoadRunEnvelopeResult,
  RunInputSnapshotRecord,
} from "../packages/ops/src/etl/run-reproducibility.types";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COUNTY_REFRESH_SCRIPT = join(PROJECT_ROOT, "scripts/refresh-county-scores.ts");

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

interface ReplayCommandContext {
  readonly backupManifestPath: string;
  readonly countyPowerSnapshot: RunInputSnapshotRecord | undefined;
  readonly databaseUrl: string;
  readonly dcPipelineSnapshot: RunInputSnapshotRecord;
  readonly env: Record<string, string>;
  readonly fromRunId: string;
  readonly replayMode: "best_effort" | "strict";
  readonly replayPackSnapshot: RunInputSnapshotRecord;
  readonly replayRoot: string;
  readonly replayRunId: string;
  readonly runtimeBackup: readonly SourceRuntimeStatusRow[];
  readonly sourceEnvelope: LoadRunEnvelopeResult;
  readonly sourceIds: readonly string[];
}

interface SourceRuntimeStatusRow {
  readonly access_status: string | null;
  readonly completeness_observed: number | null;
  readonly current_registry_version: string;
  readonly current_source_version_id: string;
  readonly freshness_as_of: string | null;
  readonly geographic_coverage_observed: string | null;
  readonly ingestion_health: string | null;
  readonly last_attempted_ingest_at: string | null;
  readonly last_successful_ingest_at: string | null;
  readonly latest_provider_update_seen_at: string | null;
  readonly license_expiration_date: string | null;
  readonly record_count: number | null;
  readonly runtime_alert_state: string | null;
  readonly source_id: string;
  readonly staleness_state: string | null;
}

function copyProcessEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.entries(env).reduce<Record<string, string>>((result, [key, value]) => {
    if (typeof value === "string") {
      result[key] = value;
    }
    return result;
  }, {});
}

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

function quotePsqlMetaPath(path: string): string {
  return `'${path.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
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

async function importReplayPack(
  databaseUrl: string,
  manifestPath: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const manifest = readJson(manifestPath, decodeReplayPackManifest);
  const importDir = mkdtempSync(join(tmpdir(), "county-rerun-import-"));
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

async function exportReplayPackBackup(
  databaseUrl: string,
  manifest: ReplayPackManifest,
  env: NodeJS.ProcessEnv,
  outputRoot: string
): Promise<string> {
  ensureDirectory(outputRoot);

  const backupTables: ReplayPackManifestTableRecord[] = [];

  for (const table of manifest.tables) {
    const outputPath = join(outputRoot, table.fileName);
    const copyCommand = `\\copy (SELECT * FROM ${table.tableName} ORDER BY ${table.orderBy}) TO ${quotePsqlMetaPath(outputPath)} CSV HEADER`;
    await runProjectCommand(
      "psql",
      [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-c", copyCommand],
      env
    );
    backupTables.push(table);
  }

  const backupManifest: ReplayPackManifest = {
    exportedAt: new Date().toISOString(),
    tables: backupTables,
  };
  const backupManifestPath = join(outputRoot, "replay-pack-manifest.json");
  writeJsonAtomic(backupManifestPath, backupManifest);
  return backupManifestPath;
}

function readRequiredInputSnapshot(
  envelope: LoadRunEnvelopeResult,
  snapshotKind: string
): RunInputSnapshotRecord {
  const snapshot = envelope.inputSnapshots.find(
    (candidate) => candidate.snapshotKind === snapshotKind
  );
  if (snapshot === undefined) {
    throw new Error(`Missing ${snapshotKind} snapshot in reproducibility envelope`);
  }

  return snapshot;
}

function buildReplayRunId(fromRunId: string): string {
  return `${fromRunId}-replay-${new Date().toISOString().replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`;
}

function readReplayMode(argv: readonly string[]): "best_effort" | "strict" {
  const value = trimToNull(findCliArgValue(argv, "--mode")) ?? "strict";
  if (value === "strict" || value === "best_effort") {
    return value;
  }

  throw new Error(`Unsupported replay mode "${value}"`);
}

function listCurrentSourceRuntimeStatus(
  sourceIds: readonly string[]
): Promise<readonly SourceRuntimeStatusRow[]> {
  if (sourceIds.length === 0) {
    return [];
  }

  const sql = getRunReproducibilitySqlClient();
  const sourceIdPlaceholders = sourceIds
    .map((_sourceId, index) => `$${String(index + 1)}`)
    .join(", ");
  return sql
    .unsafe<readonly SourceRuntimeStatusRow[]>(
      `SELECT
  source_id,
  current_registry_version,
  current_source_version_id,
  last_successful_ingest_at::text,
  last_attempted_ingest_at::text,
  latest_provider_update_seen_at::text,
  freshness_as_of::text,
  staleness_state,
  ingestion_health,
  access_status,
  runtime_alert_state,
  record_count,
  completeness_observed,
  geographic_coverage_observed,
  license_expiration_date::text
FROM registry.source_runtime_status
WHERE source_id IN (${sourceIdPlaceholders})
ORDER BY source_id`,
      [...sourceIds]
    )
    .execute();
}

async function restoreSourceRuntimeStatus(
  snapshotRows: readonly SourceRuntimeStatusRow[],
  sourceIds: readonly string[]
): Promise<void> {
  const sql = getRunReproducibilitySqlClient();
  const sourceIdPlaceholders = sourceIds
    .map((_sourceId, index) => `$${String(index + 1)}`)
    .join(", ");
  await sql.begin("read write", async (client) => {
    await client
      .unsafe(
        `DELETE FROM registry.source_runtime_status WHERE source_id IN (${sourceIdPlaceholders})`,
        [...sourceIds]
      )
      .execute();

    for (const row of snapshotRows) {
      await client`
        INSERT INTO registry.source_runtime_status (
          source_id,
          current_registry_version,
          current_source_version_id,
          last_successful_ingest_at,
          last_attempted_ingest_at,
          latest_provider_update_seen_at,
          freshness_as_of,
          staleness_state,
          ingestion_health,
          access_status,
          runtime_alert_state,
          record_count,
          completeness_observed,
          geographic_coverage_observed,
          license_expiration_date
        ) VALUES (
          ${row.source_id},
          ${row.current_registry_version},
          ${row.current_source_version_id},
          ${row.last_successful_ingest_at},
          ${row.last_attempted_ingest_at},
          ${row.latest_provider_update_seen_at},
          ${row.freshness_as_of},
          ${row.staleness_state},
          ${row.ingestion_health},
          ${row.access_status},
          ${row.runtime_alert_state},
          ${row.record_count},
          ${row.completeness_observed},
          ${row.geographic_coverage_observed},
          ${row.license_expiration_date}
        )
      `.execute();
    }
  });
}

async function applyEnvelopeSourceRuntimeSnapshot(
  envelope: LoadRunEnvelopeResult,
  replayMode: "best_effort" | "strict"
): Promise<void> {
  const sql = getRunReproducibilitySqlClient();
  const sourceIds = envelope.sourceSnapshots.map((snapshot) => snapshot.sourceId);
  const sourceIdPlaceholders = sourceIds
    .map((_sourceId, index) => `$${String(index + 1)}`)
    .join(", ");

  await sql.begin("read write", async (client) => {
    await client
      .unsafe(
        `DELETE FROM registry.source_runtime_status WHERE source_id IN (${sourceIdPlaceholders})`,
        [...sourceIds]
      )
      .execute();

    for (const snapshot of envelope.sourceSnapshots) {
      if (snapshot.sourceVersionId === null) {
        if (replayMode === "strict") {
          throw new Error(`Strict replay requires source version id for ${snapshot.sourceId}`);
        }
        continue;
      }

      await client`
        INSERT INTO registry.source_runtime_status (
          source_id,
          current_registry_version,
          current_source_version_id,
          last_successful_ingest_at,
          latest_provider_update_seen_at,
          freshness_as_of,
          staleness_state,
          ingestion_health,
          access_status,
          runtime_alert_state,
          record_count,
          completeness_observed,
          geographic_coverage_observed,
          license_expiration_date
        ) VALUES (
          ${snapshot.sourceId},
          ${envelope.envelope.registryVersion},
          ${snapshot.sourceVersionId},
          ${snapshot.lastSuccessfulIngestAt},
          ${snapshot.latestProviderUpdateSeenAt},
          ${snapshot.freshnessAsOf},
          ${snapshot.stalenessState},
          ${snapshot.ingestionHealth},
          ${snapshot.accessStatus},
          ${snapshot.runtimeAlertState},
          ${snapshot.recordCount},
          ${snapshot.completenessObserved},
          ${null},
          ${snapshot.licenseExpirationDate}
        )
      `.execute();
    }
  });
}

async function markReplayEnvelopeStatus(
  runId: string,
  status: "failed" | "replayed"
): Promise<void> {
  const envelope = await loadRunReproducibilityEnvelope("county", "replay", runId);
  if (envelope === null) {
    throw new Error(`Missing replay envelope for run ${runId}`);
  }

  await persistRunReproducibilityEnvelope({
    envelope: {
      ...envelope.envelope,
      status,
    },
    inputSnapshots: envelope.inputSnapshots,
    sourceSnapshots: envelope.sourceSnapshots,
  });
}

async function buildReplayCommandContext(argv: readonly string[]): Promise<ReplayCommandContext> {
  const surfaceScope = trimToNull(findCliArgValue(argv, "--surface")) ?? "county";
  if (surfaceScope !== "county") {
    throw new Error("Only county replay is implemented in MP-58");
  }

  const fromRunId = trimToNull(findCliArgValue(argv, "--from-run-id"));
  if (fromRunId === null) {
    throw new Error("Missing required --from-run-id");
  }

  const replayMode = readReplayMode(argv);
  const env = copyProcessEnvironment(process.env);
  await loadRunReproducibilityEnvFileIfPresent(PROJECT_ROOT, env);
  const databaseUrl = resolveDatabaseUrl(env);

  if (env.DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env.POSTGRES_URL !== undefined) {
    process.env.POSTGRES_URL = env.POSTGRES_URL;
  }

  const sourceEnvelope = await loadRunReproducibilityEnvelope("county", "publication", fromRunId);
  if (sourceEnvelope === null) {
    throw new Error(`Run reproducibility envelope not found for county/publication/${fromRunId}`);
  }

  if (replayMode === "strict" && sourceEnvelope.envelope.replayabilityTier !== "strict") {
    throw new Error(
      `Run ${fromRunId} is not strict replayable (tier=${sourceEnvelope.envelope.replayabilityTier})`
    );
  }

  const replayPackSnapshot = readRequiredInputSnapshot(sourceEnvelope, "boundary_replay_pack");
  if (replayPackSnapshot.manifestPath === null) {
    throw new Error("Replay pack manifest path is required for county replay");
  }
  const dcPipelineSnapshot = readRequiredInputSnapshot(sourceEnvelope, "dc_pipeline_self_snapshot");
  const countyPowerSnapshot = sourceEnvelope.inputSnapshots.find(
    (snapshot) => snapshot.snapshotKind === "county_power_run"
  );

  const replayPackManifest = readJson(replayPackSnapshot.manifestPath, decodeReplayPackManifest);
  const replayRoot = resolve(
    PROJECT_ROOT,
    "var",
    "run-reproducibility",
    "county",
    "replays",
    fromRunId
  );
  ensureDirectory(replayRoot);

  const backupManifestPath = await exportReplayPackBackup(
    databaseUrl,
    replayPackManifest,
    env,
    mkdtempSync(join(tmpdir(), "county-replay-backup-"))
  );
  const sourceIds = sourceEnvelope.sourceSnapshots.map((snapshot) => snapshot.sourceId);
  const runtimeBackup = await listCurrentSourceRuntimeStatus(sourceIds);

  const replayRunId = trimToNull(findCliArgValue(argv, "--run-id")) ?? buildReplayRunId(fromRunId);

  return {
    backupManifestPath,
    countyPowerSnapshot,
    databaseUrl,
    dcPipelineSnapshot,
    env,
    fromRunId,
    replayMode,
    replayPackSnapshot,
    replayRoot,
    replayRunId,
    runtimeBackup,
    sourceEnvelope,
    sourceIds,
  };
}

function buildReplayRefreshEnv(context: ReplayCommandContext): Record<string, string> {
  return {
    ...context.env,
    COUNTY_POWER_RUN_ID: context.countyPowerSnapshot?.snapshotId ?? "",
    COUNTY_SCORES_DATA_VERSION: context.sourceEnvelope.envelope.dataVersion ?? "",
    COUNTY_SCORES_DC_PIPELINE_REPLAY_RUN_ID: context.dcPipelineSnapshot.snapshotId,
    COUNTY_SCORES_FORMULA_VERSION: context.sourceEnvelope.envelope.formulaVersion ?? "",
    COUNTY_SCORES_METHODOLOGY_ID: context.sourceEnvelope.envelope.methodologyId ?? "",
    COUNTY_SCORES_MODEL_VERSION: context.sourceEnvelope.envelope.modelVersion ?? "",
    COUNTY_SCORES_REGISTRY_VERSION: context.sourceEnvelope.envelope.registryVersion ?? "",
    COUNTY_SCORES_REPLAYED_FROM_RUN_ID: context.fromRunId,
    COUNTY_SCORES_REPLAY_PACK_MANIFEST_PATH: context.replayPackSnapshot.manifestPath ?? "",
    COUNTY_SCORES_RUN_ID: context.replayRunId,
    COUNTY_SCORES_RUN_KIND: "replay",
    COUNTY_SCORES_RUN_RECORDED_AT: context.sourceEnvelope.envelope.runRecordedAt,
  };
}

async function readVerifiedReplayOutputHash(context: ReplayCommandContext): Promise<string> {
  const replayEnvelope = await loadRunReproducibilityEnvelope(
    "county",
    "replay",
    context.replayRunId
  );
  if (replayEnvelope === null) {
    throw new Error(`Replay envelope not found after rerun: ${context.replayRunId}`);
  }

  const expectedOutputHash = context.sourceEnvelope.envelope.outputHash;
  const replayOutputHash = replayEnvelope.envelope.outputHash;
  if (expectedOutputHash === null || replayOutputHash === null) {
    throw new Error("Replay output hash comparison requires non-null output hashes");
  }
  if (expectedOutputHash !== replayOutputHash) {
    await markReplayEnvelopeStatus(context.replayRunId, "failed");
    throw new Error(
      `Replay output hash mismatch for ${context.replayRunId}: expected ${expectedOutputHash}, received ${replayOutputHash}`
    );
  }

  return replayOutputHash;
}

async function main(): Promise<void> {
  const context = await buildReplayCommandContext(process.argv.slice(2));

  try {
    await applyEnvelopeSourceRuntimeSnapshot(context.sourceEnvelope, context.replayMode);
    await runProjectCommand("bun", ["run", COUNTY_REFRESH_SCRIPT], buildReplayRefreshEnv(context));

    const replayOutputHash = await readVerifiedReplayOutputHash(context);
    await markReplayEnvelopeStatus(context.replayRunId, "replayed");
    writeJsonAtomic(join(context.replayRoot, `${context.replayRunId}.json`), {
      fromRunId: context.fromRunId,
      outputHash: replayOutputHash,
      replayMode: context.replayMode,
      replayRunId: context.replayRunId,
      restoredFromBackupManifestPath: relative(PROJECT_ROOT, context.backupManifestPath),
      status: "replayed",
    });
    console.log(
      `[rerun-publication] replayed county/publication/${context.fromRunId} as ${context.replayRunId} with matching output hash ${replayOutputHash}`
    );
  } finally {
    await importReplayPack(context.databaseUrl, context.backupManifestPath, context.env);
    await restoreSourceRuntimeStatus(context.runtimeBackup, context.sourceIds);
    await closeRunReproducibilitySqlClient();
  }
}

main().catch((error) => {
  console.error("[rerun-publication] failed", error);
  process.exit(1);
});
