import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParcelsSyncStatusResponse } from "@map-migration/contracts";
import { runQuery } from "@/db/postgres";

interface EnvironmentalRunPointer {
  readonly completedAt?: unknown;
  readonly runDir?: unknown;
  readonly runId?: unknown;
}

interface EnvironmentalActiveRun {
  readonly isRunning?: unknown;
  readonly phase?: unknown;
  readonly reason?: unknown;
  readonly runId?: unknown;
  readonly startedAt?: unknown;
  readonly summary?: unknown;
  readonly updatedAt?: unknown;
}

interface EnvironmentalRunSummary {
  readonly completedAt?: unknown;
  readonly dataVersion?: unknown;
  readonly featureCount?: unknown;
  readonly runId?: unknown;
  readonly sourcePath?: unknown;
}

interface EnvironmentalMarker {
  readonly completedAt?: unknown;
  readonly phase?: unknown;
  readonly summary?: unknown;
}

interface EnvironmentalRunConfig {
  readonly createdAt?: unknown;
  readonly options?: unknown;
  readonly runId?: unknown;
}

interface EnvironmentalNormalizeProgress {
  readonly geometryBatchSize?: unknown;
  readonly lastObjectId?: unknown;
  readonly outputBytes?: unknown;
  readonly outputKind?: unknown;
  readonly pageSize?: unknown;
  readonly processedCount?: unknown;
  readonly skippedCount?: unknown;
  readonly skippedObjectIds?: unknown;
  readonly updatedAt?: unknown;
  readonly writtenCount?: unknown;
}

interface EnvironmentalLoadProgress {
  readonly completedSourceIds?: unknown;
  readonly currentSourceId?: unknown;
  readonly currentStateLabel?: unknown;
  readonly loadedRowCount?: unknown;
  readonly materializeExpectedCount?: unknown;
  readonly materializeProcessedRowCount?: unknown;
  readonly materializeRangeEnd?: unknown;
  readonly totalSourceCount?: unknown;
  readonly updatedAt?: unknown;
}

interface FloodCopyProgressRow {
  readonly bytes_processed?: number;
  readonly bytes_total?: number;
  readonly pid?: number;
  readonly rel_name?: string;
  readonly tuples_excluded?: number;
  readonly tuples_processed?: number;
}

interface FloodMaterializeProgressRow {
  readonly elapsed_seconds?: number;
  readonly pid?: number;
  readonly query?: string;
}

interface FloodStageStatsRow {
  readonly stage_rows_inserted?: number;
  readonly stage_rows_live?: number;
  readonly stage_table_bytes?: number;
}

interface EnvironmentalRunArtifacts {
  readonly activeRun: EnvironmentalActiveRun | null;
  readonly latestRunPointer: EnvironmentalRunPointer | null;
  readonly loadComplete: EnvironmentalMarker | null;
  readonly loadProgress: EnvironmentalLoadProgress | null;
  readonly normalizeArtifactHealth: EnvironmentalNormalizeArtifactHealth | null;
  readonly normalizeComplete: EnvironmentalMarker | null;
  readonly normalizeProgress: EnvironmentalNormalizeProgress | null;
  readonly publishComplete: EnvironmentalMarker | null;
  readonly runConfig: EnvironmentalRunConfig | null;
  readonly runDir: string | null;
  readonly runSummary: EnvironmentalRunSummary | null;
  readonly tileBuildComplete: EnvironmentalMarker | null;
}

interface EnvironmentalNormalizeArtifactHealth {
  readonly durableBytes: number | null;
  readonly mismatchReason: string | null;
}

interface FloodCopyProgress {
  readonly bytesProcessed: number | null;
  readonly bytesTotal: number | null;
  readonly relName: string | null;
  readonly stageRowsInserted: number | null;
  readonly stageRowsLive: number | null;
  readonly stageTableBytes: number | null;
  readonly tuplesExcluded: number | null;
  readonly tuplesProcessed: number | null;
}

interface FloodMaterializeProgress {
  readonly elapsedSeconds: number | null;
  readonly pid: number | null;
  readonly rangeEnd: number | null;
  readonly rangeStart: number | null;
}

interface FloodBuildExportProgressRow {
  readonly bytes_processed?: number;
  readonly bytes_total?: number;
  readonly elapsed_seconds?: number;
  readonly pid?: number;
  readonly tuples_processed?: number;
}

interface FloodBuildExportProgress {
  readonly bytesProcessed: number | null;
  readonly bytesTotal: number | null;
  readonly elapsedSeconds: number | null;
  readonly pid: number | null;
  readonly tuplesProcessed: number | null;
}

interface FloodBuildTelemetry {
  readonly logBytes: number | null;
  readonly percent: number | null;
  readonly sourceLabel: string | null;
  readonly stage: "build" | "convert" | "ready";
  readonly workDone: number | null;
  readonly workLeft: number | null;
  readonly workTotal: number | null;
}

interface EffectiveFloodArtifacts {
  readonly buildCompletedAt: string | null;
  readonly loadCompletedAt: string | null;
  readonly normalizeCompletedAt: string | null;
  readonly publishCompletedAt: string | null;
}

type FloodMonitorStateCode = "extract" | "normalize" | "load" | "build" | "publish";

const ENVIRONMENTAL_FLOOD_DATASET = "environmental-flood";
const FLOOD_ACTIVE_RUN_STALE_MS = 120_000;
const FLOOD_BUILD_LOG_MAX_BYTES = 1_048_576;
const FLOOD_BUILD_START_MARKER = "[tiles] building environmental flood PMTiles";
const FLOOD_ACTIVE_RANGE_PATTERN =
  /stage\.ogr_fid\s*>=\s*([0-9]+)\s+AND\s+stage\.ogr_fid\s*<=\s*([0-9]+)/i;
const FLOOD_BUILD_EXPORT_SOURCE_FILTER = "%FROM environmental_current.flood_hazard AS flood%";
const FLOOD_BUILD_EXPORT_CTE_FILTER = "%WITH flood_overlay_source AS (%";
const FLOOD_BUILD_JSON_PROGRESS_PATTERN = /{"progress":\s*([0-9]+(?:\.[0-9]+)?)\s*}/g;
const FLOOD_BUILD_REDUCED_EXPORT_COUNT_PATTERN = /\breduced-export-count=([0-9]+)\b/g;
const FLOOD_BUILD_REDUCED_FEATURE_COUNT_PATTERN = /\breduced-feature-count=([0-9]+)\b/g;
const FLOOD_BUILD_READ_FEATURES_PATTERN = /Read\s+([0-9]+(?:\.[0-9]+)?)\s+million features/g;
const FLOOD_BUILD_REORDER_PERCENT_PATTERN = /Reordering geometry:\s*([0-9]+(?:\.[0-9]+)?)%/g;
const FLOOD_BUILD_WRITE_PERCENT_PATTERN = /(^|[\r\n])\s*([0-9]+(?:\.[0-9]+)?)%\s+\d+\/\d+\/\d+\s*/g;
const MONITOR_STATES: readonly FloodMonitorStateCode[] = [
  "extract",
  "normalize",
  "load",
  "build",
  "publish",
];
const FLOOD_CANONICAL_INSERTED_PATTERN = /\b(?:inserted|loaded)=([0-9]+)\b/;
const FLOOD_CANONICAL_PERCENT_PATTERN = /\bpercent=([0-9]+)%/;
const FLOOD_NORMALIZE_WRITTEN_PATTERN = /\bwritten=([0-9]+)\b/;
const FLOOD_NORMALIZE_FETCHED_PATTERN = /\bfetched=([0-9]+)\b/;
const NON_NEGATIVE_INTEGER_STRING_PATTERN = /^[0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = readFileSync(path, "utf8");
    if (raw.trim().length === 0) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readFileTail(
  path: string,
  maxBytes: number
): { readonly size: number; readonly text: string } | null {
  if (!existsSync(path)) {
    return null;
  }

  const size = statSync(path).size;
  const readLength = Math.min(size, maxBytes);
  const startOffset = Math.max(0, size - readLength);
  const fileDescriptor = openSync(path, "r");

  try {
    const buffer = Buffer.alloc(readLength);
    const bytesRead = readSync(fileDescriptor, buffer, 0, readLength, startOffset);
    return {
      size,
      text: buffer.subarray(0, bytesRead).toString("utf8"),
    };
  } finally {
    closeSync(fileDescriptor);
  }
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readNullableInteger(value: unknown): number | null {
  if (typeof value === "number") {
    if (!(Number.isFinite(value) && Number.isInteger(value))) {
      return null;
    }

    return value >= 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!NON_NEGATIVE_INTEGER_STRING_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readNullableTimestampMs(value: unknown): number | null {
  const isoValue = readNullableString(value);
  if (isoValue === null) {
    return null;
  }

  const timestampMs = Date.parse(isoValue);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

function readNullablePhase(value: unknown): ParcelsSyncStatusResponse["run"]["phase"] | null {
  switch (value) {
    case "extracting":
    case "normalizing":
      return "extracting";
    case "loading":
      return "loading";
    case "building":
      return "building";
    case "publishing":
      return "publishing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "idle":
      return "idle";
    default:
      return null;
  }
}

function readRunPointer(value: Record<string, unknown> | null): EnvironmentalRunPointer | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readActiveRun(value: Record<string, unknown> | null): EnvironmentalActiveRun | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readRunSummary(value: Record<string, unknown> | null): EnvironmentalRunSummary | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readRunConfig(value: Record<string, unknown> | null): EnvironmentalRunConfig | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readMarker(value: Record<string, unknown> | null): EnvironmentalMarker | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readNormalizeProgress(
  value: Record<string, unknown> | null
): EnvironmentalNormalizeProgress | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readLoadProgress(value: Record<string, unknown> | null): EnvironmentalLoadProgress | null {
  if (value === null) {
    return null;
  }

  return value;
}

function readNormalizeArtifactHealth(
  runConfig: EnvironmentalRunConfig | null,
  runDir: string,
  normalizeProgress: EnvironmentalNormalizeProgress | null
): EnvironmentalNormalizeArtifactHealth | null {
  const outputBytes = readNullableInteger(normalizeProgress?.outputBytes) ?? 0;
  const writtenCount = readNullableInteger(normalizeProgress?.writtenCount) ?? 0;
  const outputKind = readNullableString(normalizeProgress?.outputKind);
  const normalizeStrategy =
    typeof runConfig?.options === "object" && runConfig.options !== null
      ? readNullableString(Reflect.get(runConfig.options, "normalizeStrategy"))
      : null;
  const sequencePath = join(runDir, "normalized", "flood-hazard.geojsonl");

  if (outputKind === "direct-postgres" || normalizeStrategy === "direct-postgres") {
    return null;
  }

  if (!existsSync(sequencePath)) {
    if (outputBytes > 0 || writtenCount > 0) {
      return {
        durableBytes: null,
        mismatchReason: `normalize output missing while progress expects ${String(outputBytes)} bytes`,
      };
    }

    return null;
  }

  const durableBytes = statSync(sequencePath).size;
  if (outputBytes > 0 && durableBytes < outputBytes) {
    return {
      durableBytes,
      mismatchReason: `normalize outputBytes=${String(outputBytes)} exceeds durable bytes=${String(durableBytes)}`,
    };
  }

  return {
    durableBytes,
    mismatchReason: null,
  };
}

function resolveProjectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
}

function resolveFloodSnapshotRoot(): string {
  const explicitRoot =
    process.env.ENVIRONMENTAL_FLOOD_SNAPSHOT_ROOT ??
    process.env.ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT ??
    null;
  if (typeof explicitRoot === "string" && explicitRoot.trim().length > 0) {
    return resolve(explicitRoot.trim());
  }

  return join(resolveProjectRoot(), "var", "environmental-sync", ENVIRONMENTAL_FLOOD_DATASET);
}

function listActiveRunArtifacts(snapshotRoot: string): readonly EnvironmentalRunArtifacts[] {
  if (!existsSync(snapshotRoot)) {
    return [];
  }

  return readdirSync(snapshotRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readRunArtifacts(snapshotRoot, join(snapshotRoot, entry.name)))
    .filter((artifacts): artifacts is EnvironmentalRunArtifacts => artifacts !== null)
    .filter((artifacts) => artifacts.activeRun !== null);
}

function sortArtifactsByUpdatedAt(
  left: EnvironmentalRunArtifacts,
  right: EnvironmentalRunArtifacts
): number {
  const leftUpdatedAt = readNullableString(left.activeRun?.updatedAt) ?? "";
  const rightUpdatedAt = readNullableString(right.activeRun?.updatedAt) ?? "";
  return rightUpdatedAt.localeCompare(leftUpdatedAt);
}

function isFreshRunningActiveRun(
  artifacts: EnvironmentalRunArtifacts | null,
  nowMs = Date.now()
): boolean {
  if (readNullableBoolean(artifacts?.activeRun?.isRunning) !== true) {
    return false;
  }

  const updatedAtMs =
    readNullableTimestampMs(artifacts?.activeRun?.updatedAt) ??
    readNullableTimestampMs(artifacts?.activeRun?.startedAt);
  if (updatedAtMs === null) {
    return false;
  }

  return Math.max(0, nowMs - updatedAtMs) <= FLOOD_ACTIVE_RUN_STALE_MS;
}

function readRunArtifacts(snapshotRoot: string, runDir: string): EnvironmentalRunArtifacts | null {
  const runId = readNullableString(readJsonFile(join(runDir, "run-config.json"))?.runId);
  const dirName = runDir.split("/").at(-1) ?? null;
  if (runId === null && dirName === null) {
    return null;
  }

  const normalizeProgress = readNormalizeProgress(
    readJsonFile(join(runDir, "normalize-progress.json"))
  );
  const runConfig = readRunConfig(readJsonFile(join(runDir, "run-config.json")));

  return {
    latestRunPointer: readRunPointer(readJsonFile(join(snapshotRoot, "latest.json"))),
    activeRun: readActiveRun(readJsonFile(join(runDir, "active-run.json"))),
    runSummary: readRunSummary(readJsonFile(join(runDir, "run-summary.json"))),
    runConfig,
    loadProgress: readLoadProgress(readJsonFile(join(runDir, "load-progress.json"))),
    normalizeProgress,
    normalizeArtifactHealth: readNormalizeArtifactHealth(runConfig, runDir, normalizeProgress),
    normalizeComplete: readMarker(readJsonFile(join(runDir, "normalize-complete.json"))),
    loadComplete: readMarker(readJsonFile(join(runDir, "load-complete.json"))),
    tileBuildComplete: readMarker(readJsonFile(join(runDir, "tile-build-complete.json"))),
    publishComplete: readMarker(readJsonFile(join(runDir, "publish-complete.json"))),
    runDir,
  };
}

function readLatestRunArtifacts(snapshotRoot: string): EnvironmentalRunArtifacts | null {
  const latestRaw = readJsonFile(join(snapshotRoot, "latest.json"));
  if (latestRaw === null) {
    return null;
  }

  const latest = readRunPointer(latestRaw);
  const explicitRunDir = readNullableString(latest?.runDir);
  const explicitRunId = readNullableString(latest?.runId);
  if (explicitRunDir !== null) {
    return readRunArtifacts(snapshotRoot, explicitRunDir);
  }

  if (explicitRunId !== null) {
    return readRunArtifacts(snapshotRoot, join(snapshotRoot, explicitRunId));
  }

  return null;
}

function selectCurrentRunArtifacts(snapshotRoot: string): EnvironmentalRunArtifacts | null {
  const activeArtifacts = [...listActiveRunArtifacts(snapshotRoot)].sort(sortArtifactsByUpdatedAt);
  const runningArtifacts = activeArtifacts.filter((artifacts) =>
    isFreshRunningActiveRun(artifacts)
  );

  if (runningArtifacts.length > 0) {
    return runningArtifacts[0] ?? null;
  }

  const latestArtifacts = readLatestRunArtifacts(snapshotRoot);
  if (latestArtifacts === null) {
    return activeArtifacts[0] ?? null;
  }

  const newestActiveArtifacts = activeArtifacts[0] ?? null;
  if (newestActiveArtifacts === null) {
    return latestArtifacts;
  }

  const latestCompletedAt =
    readNullableString(latestArtifacts.latestRunPointer?.completedAt) ??
    readNullableString(latestArtifacts.publishComplete?.completedAt) ??
    readNullableString(latestArtifacts.runSummary?.completedAt) ??
    "";
  const newestActiveUpdatedAt =
    readNullableString(newestActiveArtifacts.activeRun?.updatedAt) ?? "";

  if (newestActiveUpdatedAt.localeCompare(latestCompletedAt) > 0) {
    return newestActiveArtifacts;
  }

  return latestArtifacts;
}

async function queryFloodCopyProgress(): Promise<FloodCopyProgress | null> {
  const progressRows = await runQuery<FloodCopyProgressRow>(
    `
      SELECT
        progress.pid,
        progress.bytes_processed,
        progress.bytes_total,
        COALESCE(progress.relid::regclass::text, 'environmental_build.flood_hazard_stage') AS rel_name,
        progress.tuples_excluded,
        progress.tuples_processed
      FROM pg_stat_progress_copy AS progress
      INNER JOIN pg_stat_activity AS activity ON activity.pid = progress.pid
      WHERE activity.query ILIKE 'COPY "environmental_build"."flood_hazard_stage"%'
      ORDER BY progress.pid DESC
      LIMIT 1;
    `,
    []
  ).catch(() => []);

  const progressRow = progressRows[0];
  if (typeof progressRow === "undefined") {
    return null;
  }

  const stageStatsRows = await runQuery<FloodStageStatsRow>(
    `
      SELECT
        pg_total_relation_size('environmental_build.flood_hazard_stage')::bigint AS stage_table_bytes,
        COALESCE(
          (
            SELECT stats.n_tup_ins::bigint
            FROM pg_stat_user_tables AS stats
            WHERE stats.schemaname = 'environmental_build'
              AND stats.relname = 'flood_hazard_stage'
          ),
          0
        ) AS stage_rows_inserted,
        COALESCE(
          (
            SELECT stats.n_live_tup::bigint
            FROM pg_stat_user_tables AS stats
            WHERE stats.schemaname = 'environmental_build'
              AND stats.relname = 'flood_hazard_stage'
          ),
          0
        ) AS stage_rows_live
    `,
    []
  ).catch(() => []);

  const stageStatsRow = stageStatsRows[0];
  const stageRowsInserted = readNullableInteger(stageStatsRow?.stage_rows_inserted);
  const stageRowsLive = readNullableInteger(stageStatsRow?.stage_rows_live);
  const rawTuplesProcessed = readNullableInteger(progressRow.tuples_processed);

  return {
    bytesProcessed: readNullableInteger(progressRow.bytes_processed),
    bytesTotal: readNullableInteger(progressRow.bytes_total),
    relName: readNullableString(progressRow.rel_name),
    stageRowsInserted,
    stageRowsLive,
    stageTableBytes: readNullableInteger(stageStatsRow?.stage_table_bytes),
    tuplesExcluded: readNullableInteger(progressRow.tuples_excluded),
    tuplesProcessed: rawTuplesProcessed ?? stageRowsInserted ?? stageRowsLive,
  };
}

async function queryFloodMaterializeProgress(): Promise<FloodMaterializeProgress | null> {
  const rows = await runQuery<FloodMaterializeProgressRow>(
    `
      SELECT
        activity.pid,
        FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - activity.query_start)))::bigint AS elapsed_seconds,
        activity.query
      FROM pg_stat_activity AS activity
      WHERE activity.datname = current_database()
        AND activity.state = 'active'
        AND activity.application_name = 'psql'
        AND activity.query ILIKE '%WITH bounded_stage AS (%'
        AND (
          activity.query ILIKE '%environmental_current.flood_hazard%'
          OR activity.query ILIKE '%environmental_build.flood_hazard_materialized%'
        )
      ORDER BY activity.query_start ASC
      LIMIT 1;
    `,
    []
  ).catch(() => []);

  const row = rows[0];
  if (typeof row === "undefined") {
    return null;
  }

  const query = readNullableString(row.query);
  const rangeMatch = query === null ? null : FLOOD_ACTIVE_RANGE_PATTERN.exec(query);

  return {
    elapsedSeconds: readNullableInteger(row.elapsed_seconds),
    pid: readNullableInteger(row.pid),
    rangeStart: readNullableInteger(rangeMatch?.[1]),
    rangeEnd: readNullableInteger(rangeMatch?.[2]),
  };
}

async function queryFloodBuildExportProgress(): Promise<FloodBuildExportProgress | null> {
  const rows = await runQuery<FloodBuildExportProgressRow>(
    `
      SELECT
        progress.pid,
        progress.bytes_processed,
        progress.bytes_total,
        progress.tuples_processed,
        FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - activity.query_start)))::bigint AS elapsed_seconds
      FROM pg_stat_progress_copy AS progress
      INNER JOIN pg_stat_activity AS activity ON activity.pid = progress.pid
      WHERE progress.command = 'COPY TO'
        AND activity.query ILIKE $1
        AND activity.query ILIKE $2
      ORDER BY activity.query_start DESC, progress.pid DESC
      LIMIT 1;
    `,
    [FLOOD_BUILD_EXPORT_SOURCE_FILTER, FLOOD_BUILD_EXPORT_CTE_FILTER]
  ).catch(() => []);

  const row = rows[0];
  if (typeof row === "undefined") {
    return null;
  }

  return {
    bytesProcessed: readNullableInteger(row.bytes_processed),
    bytesTotal: readNullableInteger(row.bytes_total),
    elapsedSeconds: readNullableInteger(row.elapsed_seconds),
    pid: readNullableInteger(row.pid),
    tuplesProcessed: readNullableInteger(row.tuples_processed),
  };
}

function clampCount(value: number | null, total: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    return Math.round(value);
  }

  return Math.min(Math.round(value), total);
}

function extractLatestProgressMatch(pattern: RegExp, text: string): string | null {
  const matches = [...text.matchAll(pattern)];
  const latestMatch = matches.at(-1);
  const capturedValue = latestMatch?.[1] ?? latestMatch?.[2];
  return typeof capturedValue === "string" && capturedValue.length > 0 ? capturedValue : null;
}

function buildWeightedPercent(
  stage: "export" | "read" | "reorder" | "write",
  stagePercent: number | null
): number | null {
  const percent = clampPercent(stagePercent);
  if (percent === null) {
    return null;
  }

  switch (stage) {
    case "export":
      return Math.round(percent * 0.15 * 100) / 100;
    case "read":
      return Math.round((15 + percent * 0.35) * 100) / 100;
    case "reorder":
      return Math.round((50 + percent * 0.2) * 100) / 100;
    case "write":
      return Math.round((70 + percent * 0.3) * 100) / 100;
    default:
      return null;
  }
}

function buildFloodTileBuildSummary(
  telemetry: FloodBuildTelemetry,
  featureCount: number | null
): string {
  const percentText =
    typeof telemetry.percent === "number" ? `${telemetry.percent.toFixed(2)}%` : "n/a";
  const workDoneText = typeof telemetry.workDone === "number" ? String(telemetry.workDone) : "n/a";
  let workTotalText = "n/a";
  if (typeof telemetry.workTotal === "number") {
    workTotalText = String(telemetry.workTotal);
  } else if (featureCount !== null) {
    workTotalText = String(featureCount);
  }
  const logBytesText = typeof telemetry.logBytes === "number" ? String(telemetry.logBytes) : "n/a";
  const phaseText = telemetry.sourceLabel ?? "build";

  return [
    "tiles:building",
    "stage=build",
    `phase=${phaseText}`,
    `percent=${percentText}`,
    `work=${workDoneText}/${workTotalText}`,
    `left=${telemetry.workLeft === null ? "n/a" : String(telemetry.workLeft)}`,
    `log=${logBytesText}`,
  ].join(" ");
}

function buildFloodBuildTelemetryFromExport(
  featureCount: number | null,
  exportProgress: FloodBuildExportProgress
): FloodBuildTelemetry {
  const hasUnknownExportTotal = (readNullableInteger(exportProgress.bytesTotal) ?? 0) === 0;
  const workTotal = hasUnknownExportTotal ? null : featureCount;
  const workDone = clampCount(exportProgress.tuplesProcessed, workTotal);
  const workLeft =
    typeof workDone === "number" && typeof workTotal === "number"
      ? Math.max(0, workTotal - workDone)
      : null;
  const stagePercent =
    typeof workDone === "number" && typeof workTotal === "number" && workTotal > 0
      ? (workDone / workTotal) * 100
      : null;
  let sourceLabel = "export";
  if (hasUnknownExportTotal) {
    sourceLabel = "reduced-export";
  } else if (typeof exportProgress.elapsedSeconds === "number") {
    sourceLabel = `export ${String(exportProgress.elapsedSeconds)}s`;
  }

  return {
    stage: "build",
    percent: hasUnknownExportTotal ? null : buildWeightedPercent("export", stagePercent),
    logBytes: exportProgress.bytesProcessed ?? exportProgress.bytesTotal,
    workDone,
    workLeft,
    workTotal,
    sourceLabel,
  };
}

function buildFloodTelemetryFromOverallPercent(
  workTotal: number | null,
  logBytes: number,
  phaseLabel: string,
  overallPercent: number | null
): FloodBuildTelemetry {
  const workDone =
    typeof workTotal === "number" && overallPercent !== null
      ? Math.round((workTotal * overallPercent) / 100)
      : null;
  const workLeft =
    typeof workDone === "number" && typeof workTotal === "number"
      ? Math.max(0, workTotal - workDone)
      : null;

  return {
    stage: "build",
    percent: overallPercent,
    logBytes,
    workDone,
    workLeft,
    workTotal,
    sourceLabel: phaseLabel,
  };
}

function buildFloodTelemetryFromReadCount(
  workTotal: number | null,
  logBytes: number,
  readFeatures: number
): FloodBuildTelemetry {
  const workDone = clampCount(readFeatures, workTotal);
  const workLeft =
    typeof workDone === "number" && typeof workTotal === "number"
      ? Math.max(0, workTotal - workDone)
      : null;
  const stagePercent =
    typeof workDone === "number" && typeof workTotal === "number" && workTotal > 0
      ? (workDone / workTotal) * 100
      : null;

  return {
    stage: "build",
    percent: buildWeightedPercent("read", stagePercent),
    logBytes,
    workDone,
    workLeft,
    workTotal,
    sourceLabel: "read",
  };
}

function buildFloodTelemetryFromReducedExportCount(
  workDone: number,
  workTotal: number | null,
  logBytes: number
): FloodBuildTelemetry {
  const clampedWorkDone = clampCount(workDone, workTotal) ?? workDone;
  const workLeft = typeof workTotal === "number" ? Math.max(0, workTotal - clampedWorkDone) : null;
  const percent =
    typeof workTotal === "number" && workTotal > 0 ? (clampedWorkDone / workTotal) * 100 : null;

  return {
    stage: "build",
    percent,
    logBytes,
    workDone: clampedWorkDone,
    workLeft,
    workTotal,
    sourceLabel: "reduced-export",
  };
}

function parseFloodBuildTelemetryFromLog(
  artifacts: EnvironmentalRunArtifacts | null,
  featureCount: number | null
): FloodBuildTelemetry | null {
  const runDir = readNullableString(artifacts?.runDir);
  if (runDir === null) {
    return null;
  }

  const logTail = readFileTail(join(runDir, "runner.log"), FLOOD_BUILD_LOG_MAX_BYTES);
  if (logTail === null) {
    return null;
  }

  const normalizedText = logTail.text.replaceAll("\r", "\n");
  const latestBuildStartIndex = normalizedText.lastIndexOf(FLOOD_BUILD_START_MARKER);
  const buildText =
    latestBuildStartIndex >= 0 ? normalizedText.slice(latestBuildStartIndex) : normalizedText;

  const jsonProgressText = extractLatestProgressMatch(FLOOD_BUILD_JSON_PROGRESS_PATTERN, buildText);
  const reducedExportCountText = extractLatestProgressMatch(
    FLOOD_BUILD_REDUCED_EXPORT_COUNT_PATTERN,
    buildText
  );
  const reducedFeatureCountText = extractLatestProgressMatch(
    FLOOD_BUILD_REDUCED_FEATURE_COUNT_PATTERN,
    buildText
  );
  const writePercentText = extractLatestProgressMatch(FLOOD_BUILD_WRITE_PERCENT_PATTERN, buildText);
  const reorderPercentText = extractLatestProgressMatch(
    FLOOD_BUILD_REORDER_PERCENT_PATTERN,
    buildText
  );
  const readFeaturesText = extractLatestProgressMatch(FLOOD_BUILD_READ_FEATURES_PATTERN, buildText);

  const reducedFeatureCount =
    typeof reducedFeatureCountText === "string"
      ? readNullableInteger(reducedFeatureCountText)
      : null;
  const reducedExportCount =
    typeof reducedExportCountText === "string" ? readNullableInteger(reducedExportCountText) : null;
  const buildWorkTotal = reducedFeatureCount ?? featureCount;

  const jsonProgress =
    typeof jsonProgressText === "string" ? Number.parseFloat(jsonProgressText) : Number.NaN;
  if (Number.isFinite(jsonProgress)) {
    return buildFloodTelemetryFromOverallPercent(
      buildWorkTotal,
      logTail.size,
      "json",
      jsonProgress
    );
  }

  const writePercent =
    typeof writePercentText === "string" ? Number.parseFloat(writePercentText) : Number.NaN;
  if (Number.isFinite(writePercent)) {
    return buildFloodTelemetryFromOverallPercent(
      buildWorkTotal,
      logTail.size,
      "write",
      buildWeightedPercent("write", writePercent)
    );
  }

  const reorderPercent =
    typeof reorderPercentText === "string" ? Number.parseFloat(reorderPercentText) : Number.NaN;
  if (Number.isFinite(reorderPercent)) {
    return buildFloodTelemetryFromOverallPercent(
      buildWorkTotal,
      logTail.size,
      "reorder",
      buildWeightedPercent("reorder", reorderPercent)
    );
  }

  const readFeatures =
    typeof readFeaturesText === "string"
      ? Math.round(Number.parseFloat(readFeaturesText) * 1_000_000)
      : Number.NaN;
  if (Number.isFinite(readFeatures)) {
    return buildFloodTelemetryFromReadCount(buildWorkTotal, logTail.size, readFeatures);
  }

  if (typeof reducedExportCount === "number" && reducedExportCount >= 0) {
    return buildFloodTelemetryFromReducedExportCount(
      reducedExportCount,
      reducedFeatureCount,
      logTail.size
    );
  }

  return logTail.size > 0
    ? {
        stage: "build",
        percent: null,
        logBytes: logTail.size,
        workDone: null,
        workLeft: null,
        workTotal: buildWorkTotal,
        sourceLabel: "build",
      }
    : null;
}

function hasFreshFloodBuildLogActivity(
  artifacts: EnvironmentalRunArtifacts | null,
  nowMs = Date.now()
): boolean {
  const runDir = readNullableString(artifacts?.runDir);
  if (runDir === null) {
    return false;
  }

  const logPath = join(runDir, "runner.log");
  if (!existsSync(logPath)) {
    return false;
  }

  const modifiedAtMs = statSync(logPath).mtimeMs;
  if (!Number.isFinite(modifiedAtMs)) {
    return false;
  }

  return Math.max(0, nowMs - modifiedAtMs) <= FLOOD_ACTIVE_RUN_STALE_MS;
}

function resolveFloodTileBuildTelemetry(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  artifacts: EnvironmentalRunArtifacts | null,
  featureCount: number | null,
  buildExportProgress: FloodBuildExportProgress | null
): FloodBuildTelemetry | null {
  if (phase !== "building") {
    return artifacts?.tileBuildComplete === null
      ? null
      : {
          stage: "ready",
          percent: 100,
          logBytes: null,
          workDone: featureCount,
          workLeft: 0,
          workTotal: featureCount,
          sourceLabel: "complete",
        };
  }

  if (buildExportProgress !== null) {
    return buildFloodBuildTelemetryFromExport(featureCount, buildExportProgress);
  }

  return parseFloodBuildTelemetryFromLog(artifacts, featureCount);
}

function clampPercent(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function resolveFloodStageRows(
  copyProgress: FloodCopyProgress | null,
  completedLoadRows: number
): number | null {
  if (copyProgress === null) {
    return null;
  }

  const liveRows =
    typeof copyProgress.tuplesProcessed === "number"
      ? completedLoadRows + copyProgress.tuplesProcessed
      : null;

  return [copyProgress.stageRowsInserted, copyProgress.stageRowsLive, liveRows, completedLoadRows]
    .filter(
      (candidate): candidate is number =>
        typeof candidate === "number" && Number.isFinite(candidate)
    )
    .reduce<number | null>((largestValue, candidate) => {
      if (largestValue === null || candidate > largestValue) {
        return candidate;
      }

      return largestValue;
    }, null);
}

function resolveFloodCompletedLoadRows(artifacts: EnvironmentalRunArtifacts | null): number {
  return readNullableInteger(artifacts?.loadProgress?.loadedRowCount) ?? 0;
}

function resolveFloodMaterializeExpectedCount(
  artifacts: EnvironmentalRunArtifacts | null
): number | null {
  return readNullableInteger(artifacts?.loadProgress?.materializeExpectedCount);
}

function resolveFloodMaterializeProcessedRows(artifacts: EnvironmentalRunArtifacts | null): number {
  return readNullableInteger(artifacts?.loadProgress?.materializeProcessedRowCount) ?? 0;
}

function resolveFloodCompletedLoadStateCount(
  artifacts: EnvironmentalRunArtifacts | null
): number | null {
  const completedSourceIds = artifacts?.loadProgress?.completedSourceIds;
  return Array.isArray(completedSourceIds) ? completedSourceIds.length : null;
}

function resolveFloodTotalLoadStateCount(
  artifacts: EnvironmentalRunArtifacts | null
): number | null {
  return readNullableInteger(artifacts?.loadProgress?.totalSourceCount);
}

function buildCheckpointState(
  state: FloodMonitorStateCode,
  expectedCount: number | null,
  writtenCount: number,
  updatedAt: string | null,
  isCompleted: boolean
): ParcelsSyncStatusResponse["run"]["states"][number] {
  return {
    state,
    expectedCount,
    writtenCount,
    pagesFetched: writtenCount > 0 || isCompleted ? 1 : 0,
    lastSourceId: null,
    updatedAt,
    isCompleted,
  };
}

function buildExtractState(
  runConfigCreatedAt: string | null
): ParcelsSyncStatusResponse["run"]["states"][number] {
  return buildCheckpointState(
    "extract",
    1,
    runConfigCreatedAt === null ? 0 : 1,
    runConfigCreatedAt,
    runConfigCreatedAt !== null
  );
}

function buildNormalizeState(
  expectedCount: number | null,
  writtenCount: number,
  normalizeUpdatedAt: string | null,
  normalizeCompletedAt: string | null,
  fallbackCompletedAt: string | null
): ParcelsSyncStatusResponse["run"]["states"][number] {
  const completedAt = normalizeCompletedAt ?? fallbackCompletedAt;

  if (expectedCount !== null || writtenCount > 0) {
    return buildCheckpointState(
      "normalize",
      expectedCount,
      writtenCount,
      normalizeUpdatedAt ?? completedAt,
      normalizeCompletedAt !== null
    );
  }

  return buildCheckpointState(
    "normalize",
    1,
    completedAt === null ? 0 : 1,
    completedAt,
    completedAt !== null
  );
}

function buildLoadState(
  expectedCount: number | null,
  writtenCount: number,
  loadCompletedAt: string | null,
  activeUpdatedAt: string | null
): ParcelsSyncStatusResponse["run"]["states"][number] {
  return buildCheckpointState(
    "load",
    expectedCount,
    writtenCount,
    loadCompletedAt ?? activeUpdatedAt,
    loadCompletedAt !== null
  );
}

function buildBuildState(
  featureCount: number | null,
  buildCompletedAt: string | null,
  activeUpdatedAt: string | null,
  buildTelemetry: FloodBuildTelemetry | null
): ParcelsSyncStatusResponse["run"]["states"][number] {
  let writtenCount = 0;
  if (buildCompletedAt !== null) {
    writtenCount = featureCount ?? 0;
  } else if (typeof featureCount === "number" && typeof buildTelemetry?.percent === "number") {
    writtenCount = Math.round((featureCount * buildTelemetry.percent) / 100);
  }

  return buildCheckpointState(
    "build",
    featureCount,
    writtenCount,
    buildCompletedAt ?? activeUpdatedAt,
    buildCompletedAt !== null
  );
}

function buildPublishState(
  publishCompletedAt: string | null
): ParcelsSyncStatusResponse["run"]["states"][number] {
  return buildCheckpointState(
    "publish",
    1,
    publishCompletedAt === null ? 0 : 1,
    publishCompletedAt,
    publishCompletedAt !== null
  );
}

function buildFloodStateProgress(
  stateCode: FloodMonitorStateCode,
  featureCount: number | null,
  normalizeExpectedCount: number | null,
  loadExpectedCount: number | null,
  normalizeWrittenCount: number,
  loadWrittenCount: number,
  runConfigCreatedAt: string | null,
  normalizeUpdatedAt: string | null,
  normalizeCompletedAt: string | null,
  loadCompletedAt: string | null,
  buildCompletedAt: string | null,
  publishCompletedAt: string | null,
  activeUpdatedAt: string | null,
  buildTelemetry: FloodBuildTelemetry | null
): ParcelsSyncStatusResponse["run"]["states"][number] {
  const downstreamCompletedAt = loadCompletedAt ?? buildCompletedAt ?? publishCompletedAt;
  switch (stateCode) {
    case "extract":
      return buildExtractState(runConfigCreatedAt);
    case "normalize":
      return buildNormalizeState(
        normalizeExpectedCount,
        normalizeWrittenCount,
        normalizeUpdatedAt,
        normalizeCompletedAt,
        downstreamCompletedAt
      );
    case "load":
      return buildLoadState(loadExpectedCount, loadWrittenCount, loadCompletedAt, activeUpdatedAt);
    case "build":
      return buildBuildState(featureCount, buildCompletedAt, activeUpdatedAt, buildTelemetry);
    case "publish":
      return buildPublishState(publishCompletedAt);
    default:
      return buildPublishState(publishCompletedAt);
  }
}

function buildFloodStates(
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null,
  buildTelemetry: FloodBuildTelemetry | null
): ParcelsSyncStatusResponse["run"]["states"] {
  const featureCount = resolveFloodFeatureCount(artifacts);
  const normalizeExpectedCount = resolveFloodNormalizeExpectedCount(artifacts, featureCount);
  const runConfigCreatedAt = readNullableString(artifacts?.runConfig?.createdAt);
  const effectiveArtifacts = resolveEffectiveFloodArtifacts(artifacts, copyProgress);
  const activeUpdatedAt =
    copyProgress === null && materializeProgress === null
      ? readNullableString(artifacts?.activeRun?.updatedAt)
      : new Date().toISOString();
  const normalizeUpdatedAt =
    readNullableString(artifacts?.normalizeProgress?.updatedAt) ?? activeUpdatedAt;
  const normalizeWrittenCount = resolveFloodNormalizeWrittenCount(artifacts);
  const loadWrittenCount = resolveFloodLoadWrittenCount(
    artifacts,
    copyProgress,
    materializeProgress,
    featureCount
  );
  const loadExpectedCount = featureCount;

  return MONITOR_STATES.map((stateCode) =>
    buildFloodStateProgress(
      stateCode,
      featureCount,
      normalizeExpectedCount,
      loadExpectedCount,
      normalizeWrittenCount,
      loadWrittenCount,
      runConfigCreatedAt,
      normalizeUpdatedAt,
      effectiveArtifacts.normalizeCompletedAt,
      effectiveArtifacts.loadCompletedAt,
      effectiveArtifacts.buildCompletedAt,
      effectiveArtifacts.publishCompletedAt,
      activeUpdatedAt,
      buildTelemetry
    )
  );
}

function resolveEffectiveFloodArtifacts(
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null
): EffectiveFloodArtifacts {
  const activePhase = readNullablePhase(artifacts?.activeRun?.phase);
  const normalizeCompletedAt = readNullableString(artifacts?.normalizeComplete?.completedAt);
  const loadCompletedAt = readNullableString(artifacts?.loadComplete?.completedAt);
  const buildCompletedAt = readNullableString(artifacts?.tileBuildComplete?.completedAt);
  const publishCompletedAt = readNullableString(artifacts?.publishComplete?.completedAt);

  if (activePhase === "failed") {
    return {
      normalizeCompletedAt:
        normalizeCompletedAt ?? loadCompletedAt ?? buildCompletedAt ?? publishCompletedAt,
      loadCompletedAt: null,
      buildCompletedAt: null,
      publishCompletedAt: null,
    };
  }

  if (copyProgress === null && activePhase !== "loading") {
    return {
      normalizeCompletedAt,
      loadCompletedAt,
      buildCompletedAt,
      publishCompletedAt,
    };
  }

  return {
    normalizeCompletedAt:
      normalizeCompletedAt ?? readNullableString(artifacts?.runConfig?.createdAt) ?? null,
    loadCompletedAt: null,
    buildCompletedAt: null,
    publishCompletedAt: null,
  };
}

function resolveFloodPhase(
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null,
  buildExportProgress: FloodBuildExportProgress | null,
  buildLogTelemetry: FloodBuildTelemetry | null
): ParcelsSyncStatusResponse["run"]["phase"] {
  if (readNullableString(artifacts?.normalizeArtifactHealth?.mismatchReason) !== null) {
    return "failed";
  }

  if (copyProgress !== null || materializeProgress !== null) {
    return "loading";
  }

  if (buildExportProgress !== null) {
    return "building";
  }

  if (buildLogTelemetry !== null && hasFreshFloodBuildLogActivity(artifacts)) {
    return "building";
  }

  const activePhase = readNullablePhase(artifacts?.activeRun?.phase);
  if (activePhase !== null) {
    if (
      readNullableBoolean(artifacts?.activeRun?.isRunning) === true &&
      !isFreshRunningActiveRun(artifacts)
    ) {
      return "failed";
    }

    return activePhase;
  }

  if (artifacts?.publishComplete !== null) {
    return "completed";
  }

  if (artifacts?.tileBuildComplete !== null) {
    return "building";
  }

  if (artifacts?.loadComplete !== null) {
    return "loading";
  }

  if (artifacts?.normalizeComplete !== null) {
    return "extracting";
  }

  if (artifacts?.runConfig !== null) {
    return "extracting";
  }

  return "idle";
}

function resolveFloodNormalizeIntegritySummary(
  artifacts: EnvironmentalRunArtifacts | null
): string | null {
  const normalizeMismatchReason = readNullableString(
    artifacts?.normalizeArtifactHealth?.mismatchReason
  );
  return normalizeMismatchReason === null
    ? null
    : `normalize integrity error: ${normalizeMismatchReason}`;
}

function buildFloodLoadStagingSummary(
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress
): string {
  const completedLoadRows = resolveFloodCompletedLoadRows(artifacts);
  const stagedRows = resolveFloodStageRows(copyProgress, completedLoadRows) ?? completedLoadRows;
  const rowsText = typeof stagedRows === "number" ? String(stagedRows) : "n/a";
  const stageSizeText =
    typeof copyProgress.stageTableBytes === "number"
      ? `${String(Math.round(copyProgress.stageTableBytes / 1024 / 1024))}MB`
      : "n/a";
  return `flood-load staging rows=${rowsText} stage=${stageSizeText}`;
}

function buildFloodMaterializeSummary(
  artifacts: EnvironmentalRunArtifacts | null,
  materializeProgress: FloodMaterializeProgress
): string {
  const activeSummary = readNullableString(artifacts?.activeRun?.summary);
  const expectedCount =
    resolveFloodMaterializeExpectedCount(artifacts) ??
    readNullableInteger(artifacts?.runSummary?.featureCount);
  const canonicalInsertedCount =
    parseCanonicalInsertedCount(activeSummary) ?? resolveFloodMaterializeProcessedRows(artifacts);
  const canonicalPercent =
    parseCanonicalPercent(activeSummary) ??
    (typeof expectedCount === "number" && expectedCount > 0
      ? Math.min(100, Math.round((canonicalInsertedCount / expectedCount) * 100))
      : null);
  const loadedText =
    typeof canonicalInsertedCount === "number" ? String(canonicalInsertedCount) : "n/a";
  const percentText = typeof canonicalPercent === "number" ? `${String(canonicalPercent)}%` : "n/a";
  const rangeText =
    typeof materializeProgress.rangeStart === "number" &&
    typeof materializeProgress.rangeEnd === "number"
      ? `${String(materializeProgress.rangeStart)}-${String(materializeProgress.rangeEnd)}`
      : "n/a";
  const elapsedText =
    typeof materializeProgress.elapsedSeconds === "number"
      ? `${String(materializeProgress.elapsedSeconds)}s`
      : "n/a";
  return [
    `canonical loaded=${loadedText}`,
    `total=${expectedCount ?? "n/a"}`,
    `percent=${percentText}`,
    `range=${rangeText}`,
    `elapsed=${elapsedText}`,
    "mode=materialize",
  ].join(" ");
}

function resolveFloodSummary(
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null,
  featureCount: number | null,
  buildTelemetry: FloodBuildTelemetry | null
): string | null {
  const normalizeIntegritySummary = resolveFloodNormalizeIntegritySummary(artifacts);
  if (normalizeIntegritySummary !== null) {
    return normalizeIntegritySummary;
  }

  if (copyProgress !== null) {
    return buildFloodLoadStagingSummary(artifacts, copyProgress);
  }

  if (materializeProgress !== null) {
    return buildFloodMaterializeSummary(artifacts, materializeProgress);
  }

  if (buildTelemetry !== null) {
    return buildFloodTileBuildSummary(buildTelemetry, featureCount);
  }

  const activeSummary = readNullableString(artifacts?.activeRun?.summary);
  if (activeSummary !== null) {
    return activeSummary;
  }

  const normalizeSummary = buildFloodNormalizeSummary(
    artifacts?.normalizeProgress ?? null,
    readNullableInteger(artifacts?.runSummary?.featureCount)
  );
  if (normalizeSummary !== null) {
    return normalizeSummary;
  }

  return (
    readNullableString(artifacts?.publishComplete?.summary) ??
    readNullableString(artifacts?.tileBuildComplete?.summary) ??
    readNullableString(artifacts?.loadComplete?.summary) ??
    null
  );
}

function parseCanonicalInsertedCount(summary: string | null): number | null {
  if (typeof summary !== "string") {
    return null;
  }

  const match = FLOOD_CANONICAL_INSERTED_PATTERN.exec(summary);
  return readNullableInteger(match?.[1]);
}

function parseCanonicalPercent(summary: string | null): number | null {
  if (typeof summary !== "string") {
    return null;
  }

  return readNullableInteger(FLOOD_CANONICAL_PERCENT_PATTERN.exec(summary)?.[1]);
}

function parseNormalizeSummaryWrittenCount(summary: string | null): number | null {
  if (typeof summary !== "string") {
    return null;
  }

  return (
    readNullableInteger(FLOOD_NORMALIZE_WRITTEN_PATTERN.exec(summary)?.[1]) ??
    readNullableInteger(FLOOD_NORMALIZE_FETCHED_PATTERN.exec(summary)?.[1])
  );
}

function buildFloodNormalizeSummary(
  normalizeProgress: EnvironmentalNormalizeProgress | null,
  featureCount: number | null
): string | null {
  const writtenCount = readNullableInteger(normalizeProgress?.writtenCount) ?? 0;
  const processedCount = readNullableInteger(normalizeProgress?.processedCount) ?? 0;
  const skippedCount = readNullableInteger(normalizeProgress?.skippedCount) ?? 0;
  const pageSize = readNullableInteger(normalizeProgress?.pageSize);
  const lastObjectId = readNullableInteger(normalizeProgress?.lastObjectId);

  if (writtenCount === 0 && processedCount === 0 && skippedCount === 0) {
    return null;
  }

  const percent =
    featureCount === null || featureCount <= 0
      ? "n/a"
      : `${String(Math.min(100, Math.round((writtenCount / featureCount) * 100)))}%`;

  return [
    `normalize written=${String(writtenCount)}`,
    `processed=${String(processedCount)}`,
    `total=${featureCount === null ? "n/a" : String(featureCount)}`,
    `percent=${percent}`,
    `lastObjectId=${lastObjectId === null ? "n/a" : String(lastObjectId)}`,
    `pageSize=${pageSize === null ? "n/a" : String(pageSize)}`,
    `skipped=${String(skippedCount)}`,
  ].join(" ");
}

function buildFloodMaterializeDetail(
  materializeProgress: FloodMaterializeProgress | null
): string | null {
  const rangeText =
    typeof materializeProgress?.rangeStart === "number" &&
    typeof materializeProgress?.rangeEnd === "number"
      ? `ogr_fid ${String(materializeProgress.rangeStart)}-${String(materializeProgress.rangeEnd)}`
      : null;
  const elapsedText =
    typeof materializeProgress?.elapsedSeconds === "number"
      ? `${String(materializeProgress.elapsedSeconds)}s elapsed`
      : null;
  const detail = [rangeText, elapsedText].filter((value) => value !== null).join(" · ");
  return detail.length > 0 ? detail : null;
}

function buildFloodMaterializeDbLoadProgress(
  activeSummary: string | null,
  canonicalInsertedCount: number | null,
  canonicalPercent: number | null,
  materializeExpectedCount: number | null,
  materializeProgress: FloodMaterializeProgress | null
): NonNullable<ParcelsSyncStatusResponse["run"]["progress"]>["dbLoad"] | undefined {
  if (canonicalInsertedCount === null && materializeProgress === null) {
    return undefined;
  }

  const percent =
    clampPercent(canonicalPercent) ??
    (typeof canonicalInsertedCount === "number" &&
    typeof materializeExpectedCount === "number" &&
    materializeExpectedCount > 0
      ? clampPercent(Math.round((canonicalInsertedCount / materializeExpectedCount) * 100))
      : null);

  return {
    stepKey: "materialize",
    percent,
    loadedFiles: 1,
    totalFiles: 1,
    currentFile: buildFloodMaterializeDetail(materializeProgress) ?? activeSummary,
    completedStates: null,
    totalStates: null,
    activeWorkers:
      typeof materializeProgress?.pid === "number"
        ? [`environmental_current.flood_hazard pid=${String(materializeProgress.pid)}`]
        : ["environmental_current.flood_hazard"],
  };
}

function resolveFloodRunId(artifacts: EnvironmentalRunArtifacts | null): string | null {
  return (
    readNullableString(artifacts?.activeRun?.runId) ??
    readNullableString(artifacts?.runSummary?.runId) ??
    readNullableString(artifacts?.runConfig?.runId) ??
    readNullableString(artifacts?.latestRunPointer?.runId)
  );
}

function resolveFloodEndedAt(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  artifacts: EnvironmentalRunArtifacts | null
): string | null {
  if (phase === "failed") {
    return (
      readNullableString(artifacts?.activeRun?.updatedAt) ??
      readNullableString(artifacts?.publishComplete?.completedAt) ??
      readNullableString(artifacts?.runSummary?.completedAt)
    );
  }

  if (phase !== "completed") {
    return null;
  }

  return (
    readNullableString(artifacts?.publishComplete?.completedAt) ??
    readNullableString(artifacts?.runSummary?.completedAt)
  );
}

function resolveFloodLatestRunId(artifacts: EnvironmentalRunArtifacts | null): string | null {
  return (
    readNullableString(artifacts?.latestRunPointer?.runId) ??
    (artifacts?.publishComplete !== null ? readNullableString(artifacts?.runSummary?.runId) : null)
  );
}

function resolveFloodLatestRunCompletedAt(
  artifacts: EnvironmentalRunArtifacts | null
): string | null {
  return (
    readNullableString(artifacts?.latestRunPointer?.completedAt) ??
    readNullableString(artifacts?.publishComplete?.completedAt) ??
    readNullableString(artifacts?.runSummary?.completedAt)
  );
}

function resolveFloodDurationMs(startedAt: string | null, endedAt: string | null): number | null {
  if (startedAt === null || endedAt === null) {
    return null;
  }

  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

function resolveFloodExitCode(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  endedAt: string | null
): number | null {
  if (phase === "failed") {
    return 1;
  }

  if (endedAt === null) {
    return null;
  }

  return 0;
}

function buildFloodDbLoadProgress(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null
): NonNullable<ParcelsSyncStatusResponse["run"]["progress"]>["dbLoad"] | undefined {
  if (phase !== "loading") {
    return undefined;
  }

  const activeSummary = readNullableString(artifacts?.activeRun?.summary);
  const canonicalPercent = parseCanonicalPercent(activeSummary);
  const canonicalInsertedCount = parseCanonicalInsertedCount(activeSummary);

  if (copyProgress === null) {
    const materializeExpectedCount = resolveFloodMaterializeExpectedCount(artifacts);
    return buildFloodMaterializeDbLoadProgress(
      activeSummary,
      canonicalInsertedCount,
      canonicalPercent,
      materializeExpectedCount,
      materializeProgress
    );
  }

  const percent = artifacts?.loadComplete !== null ? 100 : null;

  return {
    stepKey: copyProgress !== null ? "staging" : "complete",
    percent,
    loadedFiles: copyProgress !== null || artifacts?.loadComplete !== null ? 1 : 0,
    totalFiles: 1,
    currentFile:
      copyProgress !== null
        ? (readNullableString(artifacts?.loadProgress?.currentStateLabel) ??
          readNullableString(artifacts?.runSummary?.sourcePath))
        : null,
    completedStates: resolveFloodCompletedLoadStateCount(artifacts),
    totalStates: resolveFloodTotalLoadStateCount(artifacts),
    activeWorkers:
      copyProgress !== null
        ? [readNullableString(copyProgress.relName) ?? "environmental_build.flood_hazard_stage"]
        : [],
  };
}

function buildFloodTileBuildProgress(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  buildTelemetry: FloodBuildTelemetry | null,
  featureCount: number | null
): NonNullable<ParcelsSyncStatusResponse["run"]["progress"]>["tileBuild"] | undefined {
  if (phase === "failed") {
    return undefined;
  }

  if (buildTelemetry === null) {
    return undefined;
  }

  return {
    stage: buildTelemetry.stage,
    percent: buildTelemetry.percent,
    logBytes: buildTelemetry.logBytes,
    readFeatures: null,
    totalFeatures: featureCount,
    workDone: buildTelemetry.workDone,
    workLeft: buildTelemetry.workLeft,
    workTotal: buildTelemetry.workTotal,
    convertPercent: buildTelemetry.stage === "ready" ? 100 : null,
    convertDone: buildTelemetry.stage === "ready" ? featureCount : null,
    convertTotal: featureCount,
    convertAttempt: null,
    convertAttemptTotal: null,
  };
}

function buildFloodRunProgress(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null,
  buildTelemetry: FloodBuildTelemetry | null,
  featureCount: number | null
): NonNullable<ParcelsSyncStatusResponse["run"]["progress"]> {
  const dbLoad = buildFloodDbLoadProgress(phase, artifacts, copyProgress, materializeProgress);
  const tileBuild = buildFloodTileBuildProgress(phase, buildTelemetry, featureCount);

  return {
    schemaVersion: 1,
    phase,
    ...(typeof dbLoad === "undefined" ? {} : { dbLoad }),
    ...(typeof tileBuild === "undefined" ? {} : { tileBuild }),
  };
}

function resolveFloodWrittenCount(
  phase: ParcelsSyncStatusResponse["run"]["phase"],
  artifacts: EnvironmentalRunArtifacts | null,
  featureCount: number | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null
): number {
  const loadWrittenCount = resolveFloodLoadWrittenCount(
    artifacts,
    copyProgress,
    materializeProgress,
    featureCount
  );
  if (phase === "loading") {
    return loadWrittenCount;
  }

  if (loadWrittenCount > 0) {
    return loadWrittenCount;
  }

  const normalizeWrittenCount = resolveFloodNormalizeWrittenCount(artifacts);
  if (phase === "failed") {
    return Math.max(loadWrittenCount, normalizeWrittenCount);
  }

  if (normalizeWrittenCount > 0) {
    return normalizeWrittenCount;
  }

  if (copyProgress !== null) {
    return 0;
  }

  if (artifacts?.loadComplete !== null) {
    return featureCount ?? 0;
  }

  return 0;
}

function resolveFloodNormalizeExpectedCount(
  artifacts: EnvironmentalRunArtifacts | null,
  featureCount: number | null
): number | null {
  if (featureCount !== null) {
    return featureCount;
  }

  const normalizeWrittenCount = resolveFloodNormalizeWrittenCount(artifacts);
  return (
    readNullableInteger(artifacts?.normalizeProgress?.processedCount) ??
    (normalizeWrittenCount > 0
      ? normalizeWrittenCount +
        (readNullableInteger(artifacts?.normalizeProgress?.skippedCount) ?? 0)
      : null)
  );
}

function resolveFloodNormalizeWrittenCount(artifacts: EnvironmentalRunArtifacts | null): number {
  return (
    readNullableInteger(artifacts?.normalizeProgress?.writtenCount) ??
    parseNormalizeSummaryWrittenCount(readNullableString(artifacts?.activeRun?.summary)) ??
    0
  );
}

function resolveFloodLoadWrittenCount(
  artifacts: EnvironmentalRunArtifacts | null,
  copyProgress: FloodCopyProgress | null,
  materializeProgress: FloodMaterializeProgress | null,
  featureCount: number | null
): number {
  const activeSummary = readNullableString(artifacts?.activeRun?.summary);
  const materializeProcessedRows = resolveFloodMaterializeProcessedRows(artifacts);
  const shouldPreferMaterializeProgress =
    materializeProgress !== null ||
    materializeProcessedRows > 0 ||
    activeSummary?.includes("mode=materialize") === true;

  if (shouldPreferMaterializeProgress) {
    const canonicalInsertedCount = parseCanonicalInsertedCount(activeSummary);
    return Math.max(canonicalInsertedCount ?? 0, materializeProcessedRows);
  }

  const completedLoadRows = resolveFloodCompletedLoadRows(artifacts);
  const stageRows = resolveFloodStageRows(copyProgress, completedLoadRows);
  if (typeof stageRows === "number") {
    return stageRows;
  }

  if (completedLoadRows > 0) {
    return completedLoadRows;
  }

  const canonicalInsertedCount = parseCanonicalInsertedCount(
    readNullableString(artifacts?.activeRun?.summary)
  );
  if (typeof canonicalInsertedCount === "number") {
    return canonicalInsertedCount;
  }

  if (artifacts?.loadComplete !== null) {
    return featureCount ?? 0;
  }

  return 0;
}

function resolveFloodFeatureCount(artifacts: EnvironmentalRunArtifacts | null): number | null {
  return (
    resolveFloodMaterializeExpectedCount(artifacts) ??
    readNullableInteger(artifacts?.runSummary?.featureCount)
  );
}

export async function getFloodSyncStatusSnapshot(): Promise<ParcelsSyncStatusResponse> {
  const snapshotRoot = resolveFloodSnapshotRoot();
  const artifacts = selectCurrentRunArtifacts(snapshotRoot);
  const copyProgress = await queryFloodCopyProgress();
  const materializeProgress = copyProgress === null ? await queryFloodMaterializeProgress() : null;
  const featureCount = resolveFloodFeatureCount(artifacts);
  const buildExportProgress = await queryFloodBuildExportProgress();
  const buildLogTelemetry = parseFloodBuildTelemetryFromLog(artifacts, featureCount);
  const phase = resolveFloodPhase(
    artifacts,
    copyProgress,
    materializeProgress,
    buildExportProgress,
    buildLogTelemetry
  );
  const buildTelemetry = resolveFloodTileBuildTelemetry(
    phase,
    artifacts,
    featureCount,
    buildExportProgress
  );
  const runId = resolveFloodRunId(artifacts);
  const startedAt =
    readNullableString(artifacts?.activeRun?.startedAt) ??
    readNullableString(artifacts?.runConfig?.createdAt);
  const endedAt = resolveFloodEndedAt(phase, artifacts);
  const hasNormalizeIntegrityFailure =
    readNullableString(artifacts?.normalizeArtifactHealth?.mismatchReason) !== null;
  const isRunning =
    !hasNormalizeIntegrityFailure &&
    (copyProgress !== null ||
      materializeProgress !== null ||
      buildExportProgress !== null ||
      (buildLogTelemetry !== null && hasFreshFloodBuildLogActivity(artifacts)) ||
      isFreshRunningActiveRun(artifacts));
  const states = buildFloodStates(artifacts, copyProgress, materializeProgress, buildTelemetry);
  const statesCompleted = states.reduce((count, stateRow) => {
    return count + (stateRow.isCompleted === true ? 1 : 0);
  }, 0);
  const progress = buildFloodRunProgress(
    phase,
    artifacts,
    copyProgress,
    materializeProgress,
    buildTelemetry,
    featureCount
  );

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    enabled: true,
    mode: "external",
    intervalMs: isRunning ? 3000 : 15_000,
    requireStartupSuccess: false,
    snapshotRoot,
    latestRunId: resolveFloodLatestRunId(artifacts),
    latestRunCompletedAt: resolveFloodLatestRunCompletedAt(artifacts),
    run: {
      runId,
      reason: "manual",
      phase,
      isRunning,
      startedAt,
      endedAt,
      durationMs: resolveFloodDurationMs(startedAt, endedAt),
      exitCode: resolveFloodExitCode(phase, endedAt),
      summary: resolveFloodSummary(
        artifacts,
        copyProgress,
        materializeProgress,
        featureCount,
        buildTelemetry
      ),
      progress,
      states,
      statesCompleted,
      statesTotal: states.length,
      writtenCount: resolveFloodWrittenCount(
        phase,
        artifacts,
        featureCount,
        copyProgress,
        materializeProgress
      ),
      expectedCount: featureCount,
      logTail: [],
    },
  };
}
