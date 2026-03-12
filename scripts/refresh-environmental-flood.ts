#!/usr/bin/env bun
import { spawn } from "node:child_process";
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  fsyncSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  truncateSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import type { Writable } from "node:stream";
import {
  ensureRunDirectories,
  materializeSource,
  parseArg,
  quoteSqlIdentifier,
  quoteSqlString,
  readOgrFeatureCount,
  readOgrFieldNames,
  readOgrGeometryFieldName,
  requireArg,
  resolveOgrDataSourcePath,
  resolveOgrFieldName,
  resolveOgrLayerName,
  resolveProjectRoot,
  resolveRunContext,
  runCommand,
  verifyRunConfig,
  writeJsonFile,
  writeRunConfig,
} from "./environmental/environmental-sync.service";
import type { RunConfigRecord } from "./environmental/environmental-sync.types";

const STRICT_FLOOD_100_ZONE_SQL = "'A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'";
const DEFAULT_FEMA_FLOOD_LAYER_URL =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28";
const FLOOD_CANONICAL_BUILD_TABLE_NAME = "environmental_build.flood_hazard_materialized";
const FLOOD_CURRENT_TABLE_NAME = "environmental_current.flood_hazard";
const FLOOD_STAGE_TABLE_NAME = "environmental_build.flood_hazard_stage";
const FLOOD_100_ZONE_CODES = Object.freeze(["A", "AE", "AH", "AO", "AR", "A99", "V", "VE"]);
const FLOOD_FILTER_WHERE =
  "FLD_ZONE IN ('A','AE','AH','AO','AR','A99','V','VE') OR SFHA_TF IN ('T','TRUE','Y') OR (FLD_ZONE = 'X' AND ZONE_SUBTY LIKE '%0.2%')";
const GEOJSON_SEQUENCE_FILE_NAME = "flood-hazard.geojsonl";
const GEOJSON_FILE_NAME = "flood-hazard.geojson";
const LOAD_PROGRESS_FILE_NAME = "load-progress.json";
const NORMALIZE_PROGRESS_FILE_NAME = "normalize-progress.json";
const LOCAL_FLOOD_NORMALIZE_STRATEGY = "direct-postgres";
const FLOOD_MATERIALIZE_BATCH_SIZE = 10_000;
const FLOOD_MATERIALIZE_PARALLEL_WORKER_COUNT = 7;
const HTTP_REQUEST_RETRY_COUNT = 4;
const HTTP_REQUEST_RETRY_BASE_DELAY_MS = 1000;
const HTTP_REQUEST_TIMEOUT_MS = 120_000;
const HTTP_GEOMETRY_REQUEST_TIMEOUT_MS = 30_000;
const LOCAL_NORMALIZE_PROGRESS_INTERVAL_MS = 3000;
const MAPSERVER_PAGE_SIZE = 500;
const MAPSERVER_GEOMETRY_BATCH_SIZE = 25;
const MAPSERVER_MIN_PAGE_SIZE = 100;
const LEADING_SLASH_PATTERN = /^\//;
const TRAILING_SLASH_PATTERN = /\/$/;
const ISO_MILLISECONDS_SUFFIX_PATTERN = /\.\d{3}Z$/;
const MATERIALIZE_COUNT_ROW_PATTERN = /^\d+\t\d+$/;
const NFHL_STATE_ZIP_PATTERN = /^NFHL_(\d{2})_\d{8}\.zip$/i;
const ZIP_SUFFIX_PATTERN = /\.zip$/i;

interface ArcgisGeoJsonFeature {
  readonly geometry: unknown;
  readonly id?: number | string;
  readonly properties?: Readonly<Record<string, unknown>> | null;
  readonly type: "Feature";
}

interface ArcgisAttributeFeature {
  readonly attributes?: Readonly<Record<string, unknown>> | null;
}

interface NormalizeProgressRecord {
  readonly geometryBatchSize: number;
  readonly lastObjectId: number | null;
  readonly outputBytes: number;
  readonly outputKind?: string;
  readonly pageSize: number;
  readonly processedCount: number;
  readonly skippedCount: number;
  readonly skippedObjectIds: readonly number[];
  readonly updatedAt: string;
  readonly writtenCount: number;
}

interface FloodLoadProgressRecord {
  readonly completedSourceIds: readonly string[];
  readonly completedSourceRowCounts: Readonly<Record<string, number>>;
  readonly currentSourceId: string | null;
  readonly currentStateLabel: string | null;
  readonly loadedRowCount: number;
  readonly materializeExpectedCount?: number;
  readonly materializeProcessedRowCount?: number;
  readonly materializeRangeEnd?: number | null;
  readonly totalSourceCount: number;
  readonly updatedAt: string;
}

interface LocalFloodStateSource {
  readonly dataSourcePath: string;
  readonly filePath: string;
  readonly layerName: string;
  readonly sourceId: string;
  readonly stateFips: string;
  readonly stateLabel: string;
}

interface LocalFloodStateSourceMetadata {
  readonly fieldNames: readonly string[];
  readonly filteredFeatureCount: number;
  readonly geometryField: string;
}

interface FloodMaterializeBatch {
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly rowCount: number;
}

interface ArcgisNormalizeSequenceArgs {
  readonly activeStatusPath: string;
  readonly dataVersion: string;
  readonly outputPath: string;
  readonly progressPath: string;
  readonly runId: string;
  readonly sourceUrl: string;
  readonly totalCount: number | null;
}

interface ArcgisNormalizeSequenceState {
  geometryBatchSize: number;
  lastObjectId: number | null;
  outputBytes: number;
  pageSize: number;
  processedCount: number;
  skippedCount: number;
  skippedObjectIds: number[];
  writtenCount: number;
}

interface ArcgisNormalizeGeometryBatch {
  readonly geometryBatchSize: number;
  readonly geometryByObjectId: ReadonlyMap<number, unknown>;
  readonly skippedObjectIds: ReadonlySet<number>;
}

interface ArcgisNormalizeFeaturePageResult {
  readonly lastObjectId: number | null;
  readonly outputPayload: string;
  readonly processedCountDelta: number;
  readonly skippedCountDelta: number;
  readonly skippedObjectIds: readonly number[];
  readonly writtenCountDelta: number;
}

interface GeoJsonSequenceFileState {
  readonly lineCount: number;
  readonly outputBytes: number;
}

interface GeoJsonSequenceGrowth {
  readonly lineCountDelta: number;
  readonly outputBytes: number;
}

interface FetchJsonOptions {
  readonly maxAttempts?: number;
  readonly retryArcgisQueryErrors?: boolean;
  readonly timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeBackoffMs(baseDelayMs: number, attempt: number): number {
  return baseDelayMs * 2 ** Math.max(0, attempt - 1);
}

function formatIsoTimestamp(date: Date): string {
  return date.toISOString().replace(ISO_MILLISECONDS_SUFFIX_PATTERN, "Z");
}

async function fetchJsonWithRetry(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  let attempt = 0;
  const maxAttempts = Math.max(1, options.maxAttempts ?? HTTP_REQUEST_RETRY_COUNT);
  const retryArcgisQueryErrors = options.retryArcgisQueryErrors ?? true;
  const timeoutMs = Math.max(1000, options.timeoutMs ?? HTTP_REQUEST_TIMEOUT_MS);

  while (true) {
    const tempOutputPath = `/tmp/flood-arcgis-${String(process.pid)}-${String(Date.now())}-${String(attempt)}.json`;

    try {
      runCommand(
        "curl",
        [
          "-L",
          "--fail",
          "--silent",
          "--show-error",
          "--compressed",
          "--max-time",
          String(Math.floor(timeoutMs / 1000)),
          "-o",
          tempOutputPath,
          url,
        ],
        {}
      );
      return JSON.parse(readFileSync(tempOutputPath, "utf8"));
    } catch (error) {
      if (!retryArcgisQueryErrors && isArcgisQueryOperationError(error)) {
        throw error;
      }

      attempt += 1;
      if (attempt > maxAttempts) {
        throw error;
      }

      await sleep(computeBackoffMs(HTTP_REQUEST_RETRY_BASE_DELAY_MS, attempt));
    } finally {
      if (existsSync(tempOutputPath)) {
        unlinkSync(tempOutputPath);
      }
    }
  }
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function readRequiredObjectId(
  properties: Readonly<Record<string, unknown>> | null | undefined
): number {
  const rawValue = properties?.OBJECTID;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return Math.floor(rawValue);
  }

  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    const parsed = Number.parseInt(rawValue.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error("ArcGIS flood feature is missing a numeric OBJECTID property.");
}

function readObjectIdList(value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const objectIds: number[] = [];
  for (const rawValue of value) {
    const objectId = readNullableInteger(rawValue);
    if (objectId === null) {
      continue;
    }

    objectIds.push(objectId);
  }

  return objectIds;
}

function normalizeNullableUpperString(value: unknown): string | null {
  const normalized = readNullableString(value);
  return normalized === null ? null : normalized.toUpperCase();
}

function buildNormalizedFloodFeature(
  feature: ArcgisGeoJsonFeature,
  dataVersion: string
): ArcgisGeoJsonFeature {
  const properties = feature.properties ?? null;
  const objectId = readRequiredObjectId(properties);
  const fldZone = normalizeNullableUpperString(properties?.FLD_ZONE) ?? "UNKNOWN";
  const zoneSubtype = normalizeNullableUpperString(properties?.ZONE_SUBTY);
  const sfha = normalizeNullableUpperString(properties?.SFHA_TF);
  const isFlood100 =
    (sfha !== null && (sfha === "T" || sfha === "TRUE" || sfha === "Y")) ||
    FLOOD_100_ZONE_CODES.includes(fldZone);
  const isFlood500 = !isFlood100 && fldZone === "X" && (zoneSubtype?.includes("0.2") ?? false);
  let floodBand = "other";
  if (isFlood100) {
    floodBand = "flood-100";
  } else if (isFlood500) {
    floodBand = "flood-500";
  }

  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      OBJECTID: objectId,
      DFIRM_ID: readNullableString(properties?.DFIRM_ID),
      FLD_ZONE: fldZone,
      ZONE_SUBTY: zoneSubtype,
      SFHA_TF: sfha,
      SOURCE_CIT: readNullableString(properties?.SOURCE_CIT),
      is_flood_100: isFlood100 ? 1 : 0,
      is_flood_500: isFlood500 ? 1 : 0,
      flood_band: floodBand,
      legend_key: floodBand,
      data_version: dataVersion,
    },
  };
}

function buildArcgisFloodAttributesQueryUrl(
  sourceUrl: string,
  lastObjectId: number | null,
  pageSize: number
): string {
  const url = new URL(`${sourceUrl.replace(TRAILING_SLASH_PATTERN, "")}/query`);
  const lowerBoundObjectId = lastObjectId ?? 0;
  const whereClause = `OBJECTID > ${String(lowerBoundObjectId)} AND (${FLOOD_FILTER_WHERE})`;
  url.searchParams.set("where", whereClause);
  url.searchParams.set("outFields", "OBJECTID,DFIRM_ID,FLD_ZONE,ZONE_SUBTY,SFHA_TF,SOURCE_CIT");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("orderByFields", "OBJECTID ASC");
  url.searchParams.set("resultRecordCount", String(pageSize));
  url.searchParams.set("f", "pjson");
  return url.toString();
}

function buildArcgisFloodGeometryQueryUrl(sourceUrl: string, objectIds: readonly number[]): string {
  const url = new URL(`${sourceUrl.replace(TRAILING_SLASH_PATTERN, "")}/query`);
  url.searchParams.set("objectIds", objectIds.join(","));
  url.searchParams.set("outFields", "OBJECTID");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");
  return url.toString();
}

async function queryArcgisFloodFeatureCount(sourceUrl: string): Promise<number> {
  const url = new URL(`${sourceUrl.replace(TRAILING_SLASH_PATTERN, "")}/query`);
  url.searchParams.set("where", FLOOD_FILTER_WHERE);
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("f", "pjson");

  const payload = await fetchJsonWithRetry(url.toString());
  const rawCount =
    typeof payload === "object" && payload !== null && "count" in payload
      ? Reflect.get(payload, "count")
      : null;
  const parsedCount = typeof rawCount === "number" ? rawCount : Number(rawCount);
  if (!Number.isFinite(parsedCount)) {
    throw new Error("ArcGIS flood count response did not include a numeric count.");
  }

  return Math.floor(parsedCount);
}

function readJsonRecord(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }

  const raw = readFileSync(path, "utf8");
  if (raw.trim().length === 0) {
    return null;
  }

  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  return parsed;
}

function readFloodFeatureCount(runSummaryPath: string): number | null {
  return readNullableInteger(readJsonRecord(runSummaryPath)?.featureCount);
}

function readFloodLoadProgress(path: string): FloodLoadProgressRecord | null {
  if (!existsSync(path)) {
    return null;
  }

  const parsed = readJsonRecord(path);
  if (parsed === null) {
    return null;
  }

  return {
    completedSourceIds: Array.isArray(parsed.completedSourceIds)
      ? parsed.completedSourceIds
          .map((value) => readNullableString(value))
          .filter((value): value is string => typeof value === "string")
      : [],
    completedSourceRowCounts:
      typeof parsed.completedSourceRowCounts === "object" &&
      parsed.completedSourceRowCounts !== null &&
      !Array.isArray(parsed.completedSourceRowCounts)
        ? Object.fromEntries(
            Object.entries(parsed.completedSourceRowCounts)
              .map(([key, value]) => [key, readNullableInteger(value)])
              .filter((entry): entry is [string, number] => typeof entry[1] === "number")
          )
        : {},
    currentSourceId: readNullableString(parsed.currentSourceId),
    currentStateLabel: readNullableString(parsed.currentStateLabel),
    loadedRowCount: readNullableInteger(parsed.loadedRowCount) ?? 0,
    materializeExpectedCount: readNullableInteger(parsed.materializeExpectedCount) ?? undefined,
    materializeProcessedRowCount:
      readNullableInteger(parsed.materializeProcessedRowCount) ?? undefined,
    materializeRangeEnd: readNullableInteger(parsed.materializeRangeEnd) ?? undefined,
    totalSourceCount: readNullableInteger(parsed.totalSourceCount) ?? 0,
    updatedAt: readNullableString(parsed.updatedAt) ?? formatIsoTimestamp(new Date()),
  };
}

function writeFloodLoadProgress(path: string, value: FloodLoadProgressRecord): void {
  let materializeRangeEndRecord: Record<string, number | null> = {};
  if (typeof value.materializeRangeEnd === "number") {
    materializeRangeEndRecord = { materializeRangeEnd: value.materializeRangeEnd };
  } else if (value.materializeRangeEnd === null) {
    materializeRangeEndRecord = { materializeRangeEnd: null };
  }
  writeJsonFile(path, {
    completedSourceIds: value.completedSourceIds,
    completedSourceRowCounts: value.completedSourceRowCounts,
    currentSourceId: value.currentSourceId,
    currentStateLabel: value.currentStateLabel,
    loadedRowCount: value.loadedRowCount,
    ...(typeof value.materializeExpectedCount === "number"
      ? { materializeExpectedCount: value.materializeExpectedCount }
      : {}),
    ...(typeof value.materializeProcessedRowCount === "number"
      ? { materializeProcessedRowCount: value.materializeProcessedRowCount }
      : {}),
    ...materializeRangeEndRecord,
    totalSourceCount: value.totalSourceCount,
    updatedAt: value.updatedAt,
  });
}

function listLocalFloodStateSources(
  sourceRootDir: string,
  layerName: string
): readonly LocalFloodStateSource[] {
  const manifestPath = join(sourceRootDir, "manifest.json");
  const manifestRaw = readJsonRecord(manifestPath);
  if (Array.isArray(manifestRaw)) {
    const manifestSources = manifestRaw
      .map((entry) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
          return null;
        }

        const fileName = readNullableString(Reflect.get(entry, "fileName"));
        const filePath = readNullableString(Reflect.get(entry, "filePath"));
        const stateFips = readNullableString(Reflect.get(entry, "stateFips"));
        const stateLabel = readNullableString(Reflect.get(entry, "stateLabel"));
        if (
          fileName === null ||
          filePath === null ||
          stateFips === null ||
          stateLabel === null ||
          !existsSync(filePath)
        ) {
          return null;
        }

        const sourceId = fileName.replace(ZIP_SUFFIX_PATTERN, "");
        return {
          dataSourcePath: `/vsizip/${filePath}/${sourceId}.gdb`,
          filePath,
          layerName,
          sourceId,
          stateFips,
          stateLabel,
        } satisfies LocalFloodStateSource;
      })
      .filter((value): value is LocalFloodStateSource => value !== null)
      .sort((left, right) => left.stateFips.localeCompare(right.stateFips));

    if (manifestSources.length > 0) {
      return manifestSources;
    }
  }

  const entries = readdirSync(sourceRootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && NFHL_STATE_ZIP_PATTERN.test(entry.name))
    .map((entry) => {
      const match = NFHL_STATE_ZIP_PATTERN.exec(entry.name);
      const stateFips = match?.[1] ?? "00";
      const sourceId = entry.name.replace(ZIP_SUFFIX_PATTERN, "");
      const filePath = join(sourceRootDir, entry.name);
      return {
        dataSourcePath: `/vsizip/${filePath}/${sourceId}.gdb`,
        filePath,
        layerName,
        sourceId,
        stateFips,
        stateLabel: stateFips,
      } satisfies LocalFloodStateSource;
    })
    .sort((left, right) => left.stateFips.localeCompare(right.stateFips));

  if (entries.length === 0) {
    throw new Error(`No FEMA state ZIP sources found in ${sourceRootDir}`);
  }

  return entries;
}

function readArcgisAttributeFeatures(value: unknown): readonly ArcgisAttributeFeature[] | null {
  if (typeof value !== "object" || value === null || !("features" in value)) {
    return null;
  }

  const rawFeatures = Reflect.get(value, "features");
  if (!Array.isArray(rawFeatures)) {
    return null;
  }

  const features: ArcgisAttributeFeature[] = [];
  for (const rawFeature of rawFeatures) {
    if (typeof rawFeature !== "object" || rawFeature === null) {
      return null;
    }

    features.push(rawFeature as ArcgisAttributeFeature);
  }

  return features;
}

function writeFloodActiveStatus(args: {
  readonly activeStatusPath: string;
  readonly phase: "loading" | "normalizing";
  readonly runId: string;
  readonly summary: string;
}): void {
  const existing = readJsonRecord(args.activeStatusPath);
  const startedAt = readNullableString(existing?.startedAt);

  writeJsonFile(args.activeStatusPath, {
    runId: args.runId,
    reason: readNullableString(existing?.reason) ?? "manual",
    phase: args.phase,
    isRunning: true,
    updatedAt: formatIsoTimestamp(new Date()),
    summary: args.summary,
    ...(startedAt === null ? {} : { startedAt }),
  });
}

function buildNormalizeSummary(
  writtenCount: number,
  processedCount: number,
  totalCount: number | null,
  lastObjectId: number | null,
  pageSize: number,
  skippedCount: number
): string {
  const percent =
    totalCount === null || totalCount <= 0
      ? null
      : Math.min(100, Math.round((writtenCount / totalCount) * 100));

  return [
    `normalize written=${String(writtenCount)}`,
    `processed=${String(processedCount)}`,
    `total=${totalCount === null ? "n/a" : String(totalCount)}`,
    `percent=${percent === null ? "n/a" : `${String(percent)}%`}`,
    `lastObjectId=${lastObjectId === null ? "n/a" : String(lastObjectId)}`,
    `pageSize=${String(pageSize)}`,
    `skipped=${String(skippedCount)}`,
  ].join(" ");
}

function buildLoadSummary(args: {
  readonly currentStateLabel: string | null;
  readonly loadedRowCount: number;
  readonly stageMegabytes: number | null;
  readonly totalCount: number | null;
  readonly completedStateCount: number;
  readonly totalStateCount: number;
}): string {
  const percent =
    args.totalCount === null || args.totalCount <= 0
      ? null
      : Math.min(100, Math.round((args.loadedRowCount / args.totalCount) * 100));

  return [
    `flood-load staging rows=${String(args.loadedRowCount)}`,
    `stage=${args.stageMegabytes === null ? "n/a" : `${String(args.stageMegabytes)}MB`}`,
    `states=${String(args.completedStateCount)}/${String(args.totalStateCount)}`,
    `current=${args.currentStateLabel ?? "n/a"}`,
    `percent=${percent === null ? "n/a" : `${String(percent)}%`}`,
  ].join(" ");
}

function queryFloodStageMegabytes(databaseUrl: string): number | null {
  try {
    const output = runCommand("psql", [
      databaseUrl,
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_total_relation_size('${FLOOD_STAGE_TABLE_NAME}')::bigint;`,
    ]);
    const bytes = readNullableInteger(output.trim());
    return bytes === null ? null : Math.round(bytes / 1024 / 1024);
  } catch {
    return null;
  }
}

function queryFloodStageRowCount(databaseUrl: string): number {
  const output = runCommand("psql", [
    databaseUrl,
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `SELECT COUNT(*)::bigint FROM ${FLOOD_STAGE_TABLE_NAME};`,
  ]);
  const count = readNullableInteger(output.trim());
  if (count === null) {
    throw new Error(`Unable to read row count for ${FLOOD_STAGE_TABLE_NAME}.`);
  }
  return count;
}

function floodTableExists(databaseUrl: string, relationName: string): boolean {
  const output = runCommand("psql", [
    databaseUrl,
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `SELECT to_regclass(${quoteSqlString(relationName)}) IS NOT NULL;`,
  ]);
  return output.trim() === "t";
}

function resetFloodMaterializedTable(databaseUrl: string): void {
  runCommand("psql", [
    databaseUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
DROP TABLE IF EXISTS ${FLOOD_CANONICAL_BUILD_TABLE_NAME};
CREATE UNLOGGED TABLE ${FLOOD_CANONICAL_BUILD_TABLE_NAME}
(LIKE ${FLOOD_CURRENT_TABLE_NAME} INCLUDING DEFAULTS INCLUDING STORAGE);
ALTER TABLE ${FLOOD_CANONICAL_BUILD_TABLE_NAME}
  ADD CONSTRAINT flood_hazard_materialized_pkey PRIMARY KEY (feature_id);
`,
  ]);
}

function createFloodMaterializedTableIndexes(databaseUrl: string): void {
  runCommand("psql", [
    databaseUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
CREATE INDEX IF NOT EXISTS flood_hazard_materialized_run_id_idx
  ON ${FLOOD_CANONICAL_BUILD_TABLE_NAME} (run_id);
CREATE INDEX IF NOT EXISTS flood_hazard_materialized_data_version_idx
  ON ${FLOOD_CANONICAL_BUILD_TABLE_NAME} (data_version DESC);
CREATE INDEX IF NOT EXISTS flood_hazard_materialized_geom_3857_gist_idx
  ON ${FLOOD_CANONICAL_BUILD_TABLE_NAME} USING gist (geom_3857);
CREATE INDEX IF NOT EXISTS flood_hazard_materialized_band_idx
  ON ${FLOOD_CANONICAL_BUILD_TABLE_NAME} (flood_band);
CREATE INDEX IF NOT EXISTS flood_hazard_materialized_flood_100_idx
  ON ${FLOOD_CANONICAL_BUILD_TABLE_NAME} (is_flood_100);
CREATE INDEX IF NOT EXISTS flood_hazard_materialized_flood_500_idx
  ON ${FLOOD_CANONICAL_BUILD_TABLE_NAME} (is_flood_500);
`,
  ]);
}

function queryNextFloodMaterializeBatches(
  databaseUrl: string,
  lastProcessedOgrFid: number,
  batchSize: number,
  maxBatchCount: number
): readonly FloodMaterializeBatch[] {
  const cappedBatchCount = Math.max(1, maxBatchCount);
  const output = runCommand("psql", [
    databaseUrl,
    "-At",
    "-F",
    "\t",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
WITH next_rows AS (
  SELECT stage.ogr_fid
  FROM ${FLOOD_STAGE_TABLE_NAME} AS stage
  WHERE stage.ogr_fid > ${String(lastProcessedOgrFid)}
  ORDER BY stage.ogr_fid
  LIMIT ${String(batchSize * cappedBatchCount)}
),
ranked_rows AS (
  SELECT
    next_rows.ogr_fid,
    ((ROW_NUMBER() OVER (ORDER BY next_rows.ogr_fid) - 1) / ${String(batchSize)})::integer AS batch_ordinal
  FROM next_rows
)
SELECT
  MIN(ranked_rows.ogr_fid)::bigint,
  MAX(ranked_rows.ogr_fid)::bigint,
  COUNT(*)::bigint
FROM ranked_rows
GROUP BY ranked_rows.batch_ordinal
ORDER BY ranked_rows.batch_ordinal;
`,
  ]).trim();

  if (output.length === 0) {
    return [];
  }

  return output
    .split("\n")
    .map((line) => {
      const [rangeStartText, rangeEndText, rowCountText] = line.split("\t");
      const rangeStart = readNullableInteger(rangeStartText);
      const rangeEnd = readNullableInteger(rangeEndText);
      const rowCount = readNullableInteger(rowCountText);
      if (rangeStart === null || rangeEnd === null || rowCount === null || rowCount <= 0) {
        throw new Error(`Invalid flood materialize batch row: ${line}`);
      }

      return {
        rangeEnd,
        rangeStart,
        rowCount,
      } satisfies FloodMaterializeBatch;
    })
    .slice(0, cappedBatchCount);
}

function runCommandAsync(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      if (code === 0) {
        resolve(stdoutChunks.join(""));
        return;
      }

      const stdout = stdoutChunks.join("").trim();
      const stderr = stderrChunks.join("").trim();
      const detail = [stdout, stderr].filter((value) => value.length > 0).join("\n");
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${String(code)}${
            detail.length > 0 ? `\n${detail}` : ""
          }`
        )
      );
    });
  });
}

async function runFloodMaterializeBatch(args: {
  readonly batch: { readonly rangeEnd: number; readonly rangeStart: number };
  readonly dataVersion: string;
  readonly databaseUrl: string;
  readonly loadSourceSrid: number;
  readonly runId: string;
}): Promise<{ readonly insertedRowCount: number; readonly processedRowCount: number }> {
  const output = (
    await runCommandAsync("psql", [
      args.databaseUrl,
      "-At",
      "-F",
      "\t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `
SET synchronous_commit = off;
SET work_mem = '256MB';
WITH bounded_stage AS (
  SELECT
    stage.dfirm_id,
    stage.fld_zone,
    stage.zone_subty,
    stage.sfha_tf,
    stage.source_cit,
    stage.is_flood_100,
    stage.is_flood_500,
    stage.flood_band,
    stage.legend_key,
    stage.data_version,
    ST_SetSRID(stage.geom, ${String(args.loadSourceSrid)}) AS source_geom
  FROM ${FLOOD_STAGE_TABLE_NAME} AS stage
  WHERE
    stage.geom IS NOT NULL
    AND stage.ogr_fid >= ${String(args.batch.rangeStart)}
    AND stage.ogr_fid <= ${String(args.batch.rangeEnd)}
),
normalized_stage AS (
  SELECT
    bounded_stage.dfirm_id,
    bounded_stage.fld_zone,
    bounded_stage.zone_subty,
    bounded_stage.sfha_tf,
    bounded_stage.source_cit,
    bounded_stage.is_flood_100,
    bounded_stage.is_flood_500,
    bounded_stage.flood_band,
    bounded_stage.legend_key,
    bounded_stage.data_version,
    CASE
      WHEN ST_IsValid(bounded_stage.source_geom)
        THEN ST_Multi(ST_CollectionExtract(bounded_stage.source_geom, 3))
      ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(bounded_stage.source_geom), 3))
    END AS source_geom
  FROM bounded_stage
),
insertable_stage AS (
  SELECT
    normalized_stage.dfirm_id,
    normalized_stage.fld_zone,
    normalized_stage.zone_subty,
    normalized_stage.sfha_tf,
    normalized_stage.source_cit,
    normalized_stage.is_flood_100,
    normalized_stage.is_flood_500,
    normalized_stage.flood_band,
    normalized_stage.legend_key,
    normalized_stage.data_version,
    normalized_stage.source_geom AS geom,
    ST_Transform(normalized_stage.source_geom, 3857) AS geom_3857
  FROM normalized_stage
  WHERE
    normalized_stage.source_geom IS NOT NULL
    AND NOT ST_IsEmpty(normalized_stage.source_geom)
),
inserted_rows AS (
  INSERT INTO ${FLOOD_CANONICAL_BUILD_TABLE_NAME} (
    feature_id,
    dfirm_id,
    fld_zone,
    zone_subty,
    sfha_tf,
    source_cit,
    is_flood_100,
    is_flood_500,
    flood_band,
    legend_key,
    data_version,
    run_id,
    geom,
    geom_3857
  )
  SELECT
    md5(
      concat_ws(
        '|',
        COALESCE(insertable_stage.dfirm_id, ''),
        COALESCE(insertable_stage.fld_zone, ''),
        COALESCE(insertable_stage.zone_subty, ''),
        encode(ST_AsEWKB(insertable_stage.geom), 'hex')
      )
    ) AS feature_id,
    insertable_stage.dfirm_id,
    COALESCE(NULLIF(insertable_stage.fld_zone, ''), 'UNKNOWN') AS fld_zone,
    NULLIF(insertable_stage.zone_subty, '') AS zone_subty,
    NULLIF(insertable_stage.sfha_tf, '') AS sfha_tf,
    NULLIF(insertable_stage.source_cit, '') AS source_cit,
    CASE
      WHEN LOWER(COALESCE(insertable_stage.is_flood_100::text, '0')) IN ('1', 't', 'true', 'y', 'yes') THEN TRUE
      ELSE FALSE
    END AS is_flood_100,
    CASE
      WHEN LOWER(COALESCE(insertable_stage.is_flood_500::text, '0')) IN ('1', 't', 'true', 'y', 'yes') THEN TRUE
      ELSE FALSE
    END AS is_flood_500,
    COALESCE(NULLIF(insertable_stage.flood_band, ''), 'other') AS flood_band,
    COALESCE(NULLIF(insertable_stage.legend_key, ''), 'other') AS legend_key,
    COALESCE(NULLIF(insertable_stage.data_version, ''), ${quoteSqlString(args.dataVersion)}) AS data_version,
    ${quoteSqlString(args.runId)} AS run_id,
    insertable_stage.geom AS geom,
    insertable_stage.geom_3857 AS geom_3857
  FROM insertable_stage
  ON CONFLICT (feature_id) DO NOTHING
  RETURNING 1
)
SELECT
  (SELECT COUNT(*)::bigint FROM bounded_stage),
  (SELECT COUNT(*)::bigint FROM inserted_rows);
`,
    ])
  ).trim();

  const countLine = output
    .split("\n")
    .map((line) => line.trim())
    .reverse()
    .find((line) => MATERIALIZE_COUNT_ROW_PATTERN.test(line));
  if (typeof countLine !== "string") {
    throw new Error(`Flood materialize batch did not return a parseable count row.\n${output}`);
  }

  const [processedRowCountText, insertedRowCountText] = countLine.split("\t");
  const processedRowCount = readNullableInteger(processedRowCountText);
  const insertedRowCount = readNullableInteger(insertedRowCountText);
  if (processedRowCount === null || insertedRowCount === null) {
    throw new Error("Flood materialize batch did not return processed/inserted row counts.");
  }

  return {
    insertedRowCount,
    processedRowCount,
  };
}

function writeFloodMaterializeStatus(args: {
  readonly activeStatusPath: string;
  readonly currentRangeEnd: number;
  readonly currentRangeStart: number;
  readonly materializedRowCount: number;
  readonly runId: string;
  readonly totalCount: number;
}): void {
  const percent =
    args.totalCount <= 0
      ? null
      : Math.min(100, Math.round((args.materializedRowCount / args.totalCount) * 100));
  writeFloodActiveStatus({
    activeStatusPath: args.activeStatusPath,
    phase: "loading",
    runId: args.runId,
    summary: [
      `canonical loaded=${String(args.materializedRowCount)}`,
      `total=${String(args.totalCount)}`,
      `percent=${percent === null ? "n/a" : `${String(percent)}%`}`,
      `range=${String(args.currentRangeStart)}-${String(args.currentRangeEnd)}`,
      "mode=materialize",
    ].join(" "),
  });
}

function finalizeFloodMaterializedTable(databaseUrl: string): void {
  runCommand("psql", [
    databaseUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
BEGIN;
DROP TABLE ${FLOOD_CURRENT_TABLE_NAME};
ALTER TABLE ${FLOOD_CANONICAL_BUILD_TABLE_NAME} SET SCHEMA environmental_current;
ALTER TABLE environmental_current.flood_hazard_materialized RENAME TO flood_hazard;
COMMIT;
`,
  ]);
}

async function materializeFloodCanonicalTable(args: {
  readonly activeStatusPath: string;
  readonly context: ReturnType<typeof resolveRunContext>;
  readonly databaseUrl: string;
  readonly loadSourceSrid: number;
  readonly notes: string;
  readonly runConfig: RunConfigRecord;
  readonly sourcePath: string;
  readonly sourceUrl: string;
}): Promise<void> {
  runCommand("psql", [
    args.databaseUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
INSERT INTO environmental_meta.flood_runs (
  run_id,
  data_version,
  source_path,
  source_url,
  started_at,
  completed_at,
  status,
  notes
)
VALUES (
  ${quoteSqlString(args.runConfig.runId)},
  ${quoteSqlString(args.runConfig.dataVersion)},
  NULLIF(${quoteSqlString(args.sourcePath)}, ''),
  NULLIF(${quoteSqlString(args.sourceUrl)}, ''),
  now(),
  NULL,
  'loading',
  COALESCE(NULLIF(${quoteSqlString(args.notes)}, ''), '{}')::jsonb
)
ON CONFLICT (run_id) DO UPDATE
SET
  data_version = EXCLUDED.data_version,
  source_path = EXCLUDED.source_path,
  source_url = EXCLUDED.source_url,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;
`,
  ]);

  const loadProgressPath = join(args.context.runDir, LOAD_PROGRESS_FILE_NAME);
  const currentLoadProgress = readFloodLoadProgress(loadProgressPath);
  const materializeExpectedCount = queryFloodStageRowCount(args.databaseUrl);
  const canResumeMaterialize =
    currentLoadProgress !== null &&
    floodTableExists(args.databaseUrl, FLOOD_CANONICAL_BUILD_TABLE_NAME) &&
    typeof currentLoadProgress.materializeProcessedRowCount === "number";

  if (!canResumeMaterialize) {
    resetFloodMaterializedTable(args.databaseUrl);
  }

  let materializeProcessedRowCount = canResumeMaterialize
    ? (currentLoadProgress?.materializeProcessedRowCount ?? 0)
    : 0;
  let materializeRangeEnd = canResumeMaterialize
    ? (currentLoadProgress?.materializeRangeEnd ?? 0)
    : 0;

  const persistMaterializeProgress = () => {
    writeFloodLoadProgress(loadProgressPath, {
      completedSourceIds: currentLoadProgress?.completedSourceIds ?? [],
      completedSourceRowCounts: currentLoadProgress?.completedSourceRowCounts ?? {},
      currentSourceId: null,
      currentStateLabel: null,
      loadedRowCount: materializeExpectedCount,
      materializeExpectedCount,
      materializeProcessedRowCount,
      materializeRangeEnd,
      totalSourceCount: currentLoadProgress?.totalSourceCount ?? 0,
      updatedAt: formatIsoTimestamp(new Date()),
    });
  };

  persistMaterializeProgress();

  while (true) {
    const nextBatches = queryNextFloodMaterializeBatches(
      args.databaseUrl,
      materializeRangeEnd,
      FLOOD_MATERIALIZE_BATCH_SIZE,
      FLOOD_MATERIALIZE_PARALLEL_WORKER_COUNT
    );
    if (nextBatches.length === 0) {
      break;
    }

    const completedBatches = await Promise.all(
      nextBatches.map(async (batch) => ({
        batch,
        counts: await runFloodMaterializeBatch({
          batch,
          dataVersion: args.runConfig.dataVersion,
          databaseUrl: args.databaseUrl,
          loadSourceSrid: args.loadSourceSrid,
          runId: args.runConfig.runId,
        }),
      }))
    );

    const orderedCompletedBatches = [...completedBatches].sort(
      (left, right) => left.batch.rangeStart - right.batch.rangeStart
    );
    for (const completedBatch of orderedCompletedBatches) {
      materializeProcessedRowCount += completedBatch.counts.processedRowCount;
      materializeRangeEnd = completedBatch.batch.rangeEnd;
    }

    persistMaterializeProgress();
    const firstBatch = orderedCompletedBatches[0];
    const lastBatch = orderedCompletedBatches.at(-1);
    writeFloodMaterializeStatus({
      activeStatusPath: args.activeStatusPath,
      currentRangeEnd: lastBatch?.batch.rangeEnd ?? materializeRangeEnd,
      currentRangeStart: firstBatch?.batch.rangeStart ?? materializeRangeEnd,
      materializedRowCount: materializeProcessedRowCount,
      runId: args.context.runId,
      totalCount: materializeExpectedCount,
    });
  }

  createFloodMaterializedTableIndexes(args.databaseUrl);
  runCommand("psql", [
    args.databaseUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
SET maintenance_work_mem = '1GB';
ANALYZE ${FLOOD_CANONICAL_BUILD_TABLE_NAME};
`,
  ]);
  finalizeFloodMaterializedTable(args.databaseUrl);
  runCommand("psql", [
    args.databaseUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
UPDATE environmental_meta.flood_runs
SET
  completed_at = now(),
  status = 'completed',
  notes = COALESCE(NULLIF(${quoteSqlString(args.notes)}, ''), '{}')::jsonb
WHERE run_id = ${quoteSqlString(args.runConfig.runId)};

DROP TABLE IF EXISTS ${FLOOD_STAGE_TABLE_NAME};

ANALYZE environmental_meta.flood_runs;
ANALYZE ${FLOOD_CURRENT_TABLE_NAME};
`,
  ]);
}

function readNormalizeProgress(path: string): NormalizeProgressRecord | null {
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  return {
    geometryBatchSize: Math.max(
      1,
      readNullableInteger(Reflect.get(parsed, "geometryBatchSize")) ?? MAPSERVER_GEOMETRY_BATCH_SIZE
    ),
    lastObjectId: readNullableInteger(Reflect.get(parsed, "lastObjectId")),
    ...(readNullableString(Reflect.get(parsed, "outputKind")) === null
      ? {}
      : { outputKind: readNullableString(Reflect.get(parsed, "outputKind")) ?? undefined }),
    outputBytes: Math.max(0, readNullableInteger(Reflect.get(parsed, "outputBytes")) ?? 0),
    pageSize: Math.max(
      1,
      readNullableInteger(Reflect.get(parsed, "pageSize")) ?? MAPSERVER_PAGE_SIZE
    ),
    processedCount: Math.max(0, readNullableInteger(Reflect.get(parsed, "processedCount")) ?? 0),
    skippedObjectIds: readObjectIdList(Reflect.get(parsed, "skippedObjectIds")),
    skippedCount: Math.max(0, readNullableInteger(Reflect.get(parsed, "skippedCount")) ?? 0),
    updatedAt:
      readNullableString(Reflect.get(parsed, "updatedAt")) ?? formatIsoTimestamp(new Date()),
    writtenCount: Math.max(0, readNullableInteger(Reflect.get(parsed, "writtenCount")) ?? 0),
  };
}

function writeNormalizeCheckpoint(args: {
  readonly activeStatusPath: string;
  readonly geometryBatchSize: number;
  readonly lastObjectId: number | null;
  readonly outputKind?: string;
  readonly outputBytes: number;
  readonly pageSize: number;
  readonly processedCount: number;
  readonly progressPath: string;
  readonly runId: string;
  readonly skippedObjectIds: readonly number[];
  readonly skippedCount: number;
  readonly totalCount: number | null;
  readonly writtenCount: number;
}): void {
  const updatedAt = formatIsoTimestamp(new Date());
  writeJsonFile(args.progressPath, {
    geometryBatchSize: args.geometryBatchSize,
    lastObjectId: args.lastObjectId,
    ...(typeof args.outputKind === "string" ? { outputKind: args.outputKind } : {}),
    outputBytes: args.outputBytes,
    pageSize: args.pageSize,
    processedCount: args.processedCount,
    skippedObjectIds: args.skippedObjectIds,
    skippedCount: args.skippedCount,
    updatedAt,
    writtenCount: args.writtenCount,
  });

  writeFloodActiveStatus({
    activeStatusPath: args.activeStatusPath,
    phase: "normalizing",
    runId: args.runId,
    summary: buildNormalizeSummary(
      args.writtenCount,
      args.processedCount,
      args.totalCount,
      args.lastObjectId,
      args.pageSize,
      args.skippedCount
    ),
  });
}

function isArcgisQueryOperationError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("error performing query operation") ||
    message.includes("http 500") ||
    message.includes("error: 500") ||
    message.includes("returned error: 500") ||
    message.includes("http 502") ||
    message.includes("http 503") ||
    message.includes("http 504") ||
    message.includes("service unavailable") ||
    message.includes("gateway time-out") ||
    message.includes("gateway timeout") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("recv failure: connection reset by peer") ||
    message.includes("connection reset by peer") ||
    message.includes("empty reply from server") ||
    message.includes("unexpected eof") ||
    message.includes("exit code 28") ||
    message.includes("exit code 35") ||
    message.includes("exit code 52") ||
    message.includes("exit code 56")
  );
}

async function fetchArcgisFloodFeaturePage(args: {
  readonly lastObjectId: number | null;
  readonly pageSize: number;
  readonly sourceUrl: string;
}): Promise<{
  readonly features: readonly ArcgisAttributeFeature[];
  readonly pageSize: number;
}> {
  let nextPageSize = args.pageSize;

  while (nextPageSize >= MAPSERVER_MIN_PAGE_SIZE) {
    try {
      const payload = await fetchJsonWithRetry(
        buildArcgisFloodAttributesQueryUrl(args.sourceUrl, args.lastObjectId, nextPageSize)
      );
      const features = readArcgisAttributeFeatures(payload);

      if (features === null) {
        throw new Error("ArcGIS flood attribute query did not return a features array.");
      }

      return {
        features,
        pageSize: nextPageSize,
      };
    } catch (error) {
      if (!isArcgisQueryOperationError(error) || nextPageSize <= MAPSERVER_MIN_PAGE_SIZE) {
        throw error;
      }

      const reducedPageSize = Math.max(MAPSERVER_MIN_PAGE_SIZE, Math.floor(nextPageSize / 2));
      if (reducedPageSize === nextPageSize) {
        throw error;
      }

      nextPageSize = reducedPageSize;
    }
  }

  throw new Error("ArcGIS flood query pagination exhausted all page-size fallbacks.");
}

async function fetchArcgisFloodGeometryFeatures(args: {
  readonly geometryBatchSize: number;
  readonly objectIds: readonly number[];
  readonly sourceUrl: string;
}): Promise<{
  readonly features: readonly ArcgisGeoJsonFeature[];
  readonly geometryBatchSize: number;
  readonly skippedObjectIds: readonly number[];
}> {
  let nextGeometryBatchSize = args.geometryBatchSize;

  while (nextGeometryBatchSize >= 1) {
    const nextObjectIds = args.objectIds.slice(0, nextGeometryBatchSize);

    try {
      const payload = await fetchJsonWithRetry(
        buildArcgisFloodGeometryQueryUrl(args.sourceUrl, nextObjectIds),
        {
          maxAttempts: 1,
          retryArcgisQueryErrors: false,
          timeoutMs: HTTP_GEOMETRY_REQUEST_TIMEOUT_MS,
        }
      );
      const features = readGeoJsonFeatures(payload);
      if (features === null) {
        throw new Error("ArcGIS flood geometry query did not return a GeoJSON features array.");
      }

      return {
        features,
        geometryBatchSize: nextGeometryBatchSize,
        skippedObjectIds: [],
      };
    } catch (error) {
      if (!isArcgisQueryOperationError(error)) {
        throw error;
      }

      if (nextGeometryBatchSize <= 1) {
        console.warn(
          `Skipping FEMA flood OBJECTID ${String(nextObjectIds[0] ?? "n/a")} after repeated query failures: ${String(
            error instanceof Error ? error.message : error
          )}`
        );
        return {
          features: [],
          geometryBatchSize: 1,
          skippedObjectIds: nextObjectIds,
        };
      }

      const reducedGeometryBatchSize = Math.max(1, Math.floor(nextGeometryBatchSize / 2));
      if (reducedGeometryBatchSize === nextGeometryBatchSize) {
        throw error;
      }

      nextGeometryBatchSize = reducedGeometryBatchSize;
    }
  }

  throw new Error("ArcGIS flood geometry batching exhausted all page-size fallbacks.");
}

function buildArcgisNormalizeSequenceState(
  resumeProgress: NormalizeProgressRecord | null
): ArcgisNormalizeSequenceState {
  return {
    geometryBatchSize: resumeProgress?.geometryBatchSize ?? MAPSERVER_GEOMETRY_BATCH_SIZE,
    lastObjectId: resumeProgress?.lastObjectId ?? null,
    outputBytes: resumeProgress?.outputBytes ?? 0,
    pageSize: resumeProgress?.pageSize ?? MAPSERVER_PAGE_SIZE,
    processedCount: resumeProgress?.processedCount ?? 0,
    skippedObjectIds: [...(resumeProgress?.skippedObjectIds ?? [])],
    skippedCount: resumeProgress?.skippedCount ?? 0,
    writtenCount: resumeProgress?.writtenCount ?? 0,
  };
}

function writeArcgisNormalizeSequenceCheckpoint(
  args: ArcgisNormalizeSequenceArgs,
  state: ArcgisNormalizeSequenceState
): void {
  writeNormalizeCheckpoint({
    activeStatusPath: args.activeStatusPath,
    geometryBatchSize: state.geometryBatchSize,
    lastObjectId: state.lastObjectId,
    outputKind: "geojsonseq",
    outputBytes: state.outputBytes,
    pageSize: state.pageSize,
    processedCount: state.processedCount,
    progressPath: args.progressPath,
    runId: args.runId,
    skippedObjectIds: state.skippedObjectIds,
    skippedCount: state.skippedCount,
    totalCount: args.totalCount,
    writtenCount: state.writtenCount,
  });
}
function serializeArcgisNormalizedFeature(
  dataVersion: string,
  feature: ArcgisAttributeFeature,
  geometry: unknown
): string {
  return `${JSON.stringify(
    buildNormalizedFloodFeature(
      {
        type: "Feature",
        geometry,
        properties: feature.attributes ?? null,
      },
      dataVersion
    )
  )}\n`;
}

async function buildArcgisFloodGeometryBatch(args: {
  readonly attributeFeatures: readonly ArcgisAttributeFeature[];
  readonly geometryBatchSize: number;
  readonly sourceUrl: string;
}): Promise<ArcgisNormalizeGeometryBatch> {
  const geometryByObjectId = new Map<number, unknown>();
  const skippedObjectIds = new Set<number>();
  let geometryBatchSize = args.geometryBatchSize;
  let geometryIndex = 0;

  while (geometryIndex < args.attributeFeatures.length) {
    const remainingObjectIds = args.attributeFeatures
      .slice(geometryIndex)
      .map((feature) => readRequiredObjectId(feature.attributes ?? null));
    const geometryPage = await fetchArcgisFloodGeometryFeatures({
      geometryBatchSize,
      objectIds: remainingObjectIds,
      sourceUrl: args.sourceUrl,
    });

    for (const geometryFeature of geometryPage.features) {
      const objectId = readRequiredObjectId(
        geometryFeature.properties ?? { OBJECTID: geometryFeature.id }
      );
      geometryByObjectId.set(objectId, geometryFeature.geometry);
    }

    for (const skippedObjectId of geometryPage.skippedObjectIds) {
      skippedObjectIds.add(skippedObjectId);
    }

    geometryIndex += geometryPage.geometryBatchSize;
    geometryBatchSize = resolveNextArcgisGeometryBatchSize(
      geometryPage.geometryBatchSize,
      args.attributeFeatures.length - geometryIndex
    );
  }

  return {
    geometryBatchSize,
    geometryByObjectId,
    skippedObjectIds,
  };
}

export function resolveNextArcgisGeometryBatchSize(
  committedGeometryBatchSize: number,
  remainingObjectCount: number
): number {
  if (remainingObjectCount <= 0) {
    return Math.max(1, Math.min(MAPSERVER_GEOMETRY_BATCH_SIZE, committedGeometryBatchSize));
  }

  const boundedCommittedBatchSize = Math.max(1, committedGeometryBatchSize);
  const recoveredBatchSize = Math.max(boundedCommittedBatchSize + 1, boundedCommittedBatchSize * 2);
  return Math.min(MAPSERVER_GEOMETRY_BATCH_SIZE, remainingObjectCount, recoveredBatchSize);
}

function validateArcgisNormalizeObjectId(lastObjectId: number | null, nextObjectId: number): void {
  if (lastObjectId !== null && nextObjectId <= lastObjectId) {
    throw new Error(
      `ArcGIS flood query pagination did not advance OBJECTID (last=${String(lastObjectId)} next=${String(nextObjectId)}).`
    );
  }
}

function processArcgisNormalizeFeature(args: {
  readonly dataVersion: string;
  readonly feature: ArcgisAttributeFeature;
  readonly geometryByObjectId: ReadonlyMap<number, unknown>;
  readonly outputLines: string[];
  readonly pageState: {
    lastObjectId: number | null;
    processedCountDelta: number;
    skippedCountDelta: number;
    skippedObjectIds: number[];
    writtenCountDelta: number;
  };
  readonly skippedObjectIds: ReadonlySet<number>;
}): void {
  const objectId = readRequiredObjectId(args.feature.attributes ?? null);
  validateArcgisNormalizeObjectId(args.pageState.lastObjectId, objectId);

  if (args.skippedObjectIds.has(objectId)) {
    args.pageState.lastObjectId = objectId;
    args.pageState.processedCountDelta += 1;
    args.pageState.skippedCountDelta += 1;
    args.pageState.skippedObjectIds.push(objectId);
    return;
  }

  const geometry = args.geometryByObjectId.get(objectId);
  if (typeof geometry === "undefined") {
    throw new Error(`ArcGIS flood geometry batch omitted OBJECTID ${String(objectId)}.`);
  }

  args.outputLines.push(serializeArcgisNormalizedFeature(args.dataVersion, args.feature, geometry));
  args.pageState.lastObjectId = objectId;
  args.pageState.processedCountDelta += 1;
  args.pageState.writtenCountDelta += 1;
}

async function processArcgisNormalizeFeaturePage(args: {
  readonly attributeFeatures: readonly ArcgisAttributeFeature[];
  readonly sequenceArgs: ArcgisNormalizeSequenceArgs;
  readonly state: ArcgisNormalizeSequenceState;
}): Promise<ArcgisNormalizeFeaturePageResult> {
  const geometryBatch = await buildArcgisFloodGeometryBatch({
    attributeFeatures: args.attributeFeatures,
    geometryBatchSize: args.state.geometryBatchSize,
    sourceUrl: args.sequenceArgs.sourceUrl,
  });
  args.state.geometryBatchSize = geometryBatch.geometryBatchSize;

  const outputLines: string[] = [];
  const pageState = {
    lastObjectId: args.state.lastObjectId,
    processedCountDelta: 0,
    skippedCountDelta: 0,
    skippedObjectIds: [] as number[],
    writtenCountDelta: 0,
  };

  for (const feature of args.attributeFeatures) {
    processArcgisNormalizeFeature({
      dataVersion: args.sequenceArgs.dataVersion,
      feature,
      geometryByObjectId: geometryBatch.geometryByObjectId,
      outputLines,
      pageState,
      skippedObjectIds: geometryBatch.skippedObjectIds,
    });
  }

  return {
    lastObjectId: pageState.lastObjectId,
    outputPayload: outputLines.join(""),
    processedCountDelta: pageState.processedCountDelta,
    skippedCountDelta: pageState.skippedCountDelta,
    skippedObjectIds: pageState.skippedObjectIds,
    writtenCountDelta: pageState.writtenCountDelta,
  };
}

function writeLine(writer: Writable, line: string): Promise<void> {
  if (writer.write(line)) {
    return Promise.resolve();
  }

  return new Promise((resolveWrite, rejectWrite) => {
    const handleDrain = (): void => {
      cleanup();
      resolveWrite();
    };
    const handleError = (error: Error): void => {
      cleanup();
      rejectWrite(error);
    };
    const cleanup = (): void => {
      writer.off("drain", handleDrain);
      writer.off("error", handleError);
    };

    writer.on("drain", handleDrain);
    writer.on("error", handleError);
  });
}

function closeWriter(writer: Writable): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    const handleFinish = (): void => {
      cleanup();
      resolveClose();
    };
    const handleError = (error: Error): void => {
      cleanup();
      rejectClose(error);
    };
    const cleanup = (): void => {
      writer.off("finish", handleFinish);
      writer.off("error", handleError);
    };

    writer.on("finish", handleFinish);
    writer.on("error", handleError);
    writer.end();
  });
}

async function reconcileGeoJsonSequenceFileToLineCount(
  outputPath: string,
  expectedLineCount: number
): Promise<void> {
  if (!existsSync(outputPath)) {
    if (expectedLineCount === 0) {
      return;
    }

    throw new Error(
      `Normalize progress expects ${String(expectedLineCount)} rows but output file is missing: ${outputPath}`
    );
  }

  const tempPath = `${outputPath}.resume-${process.pid}.tmp`;
  const reader = createInterface({
    input: createReadStream(outputPath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  const writer = createWriteStream(tempPath, {
    flags: "w",
    encoding: "utf8",
  });

  let seenLineCount = 0;

  try {
    for await (const line of reader) {
      seenLineCount += 1;
      if (seenLineCount > expectedLineCount) {
        break;
      }

      await writeLine(writer, `${line}\n`);
    }
  } finally {
    await closeWriter(writer);
  }

  if (seenLineCount < expectedLineCount) {
    rmSync(tempPath, { force: true });
    throw new Error(
      `Normalize progress expects ${String(expectedLineCount)} rows but file only has ${String(seenLineCount)}: ${outputPath}`
    );
  }

  renameSync(tempPath, outputPath);
}

async function inspectGeoJsonSequenceFileState(
  outputPath: string
): Promise<GeoJsonSequenceFileState> {
  if (!existsSync(outputPath)) {
    throw new Error(`GeoJSON sequence file is missing: ${outputPath}`);
  }

  const reader = createInterface({
    input: createReadStream(outputPath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  let lineCount = 0;

  for await (const line of reader) {
    lineCount += 1;
    try {
      JSON.parse(line);
    } catch (error) {
      throw new Error(
        `GeoJSON sequence file contains invalid JSON at line ${String(lineCount)}: ${outputPath}`,
        {
          cause: error,
        }
      );
    }
  }

  return {
    lineCount,
    outputBytes: statSync(outputPath).size,
  };
}

export async function inspectGeoJsonSequenceGrowth(
  outputPath: string,
  committedBytes: number
): Promise<GeoJsonSequenceGrowth> {
  if (!existsSync(outputPath)) {
    return {
      lineCountDelta: 0,
      outputBytes: committedBytes,
    };
  }

  const currentSize = statSync(outputPath).size;
  if (currentSize <= committedBytes) {
    return {
      lineCountDelta: 0,
      outputBytes: committedBytes,
    };
  }

  const reader = createReadStream(outputPath, {
    start: committedBytes,
    end: currentSize - 1,
  });

  let absoluteOffset = committedBytes;
  let lineCountDelta = 0;
  let lastCommittedByte = committedBytes;

  for await (const chunk of reader) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    for (let index = 0; index < buffer.length; index += 1) {
      if (buffer[index] !== 0x0a) {
        continue;
      }

      lineCountDelta += 1;
      lastCommittedByte = absoluteOffset + index + 1;
    }

    absoluteOffset += buffer.length;
  }

  return {
    lineCountDelta,
    outputBytes: lastCommittedByte,
  };
}

function rebuildNormalizeProgressFromDurableOutput(
  resumeProgress: NormalizeProgressRecord,
  durableState: GeoJsonSequenceFileState
): NormalizeProgressRecord {
  return {
    ...resumeProgress,
    outputBytes: durableState.outputBytes,
    processedCount: durableState.lineCount + resumeProgress.skippedCount,
    updatedAt: formatIsoTimestamp(new Date()),
    writtenCount: durableState.lineCount,
  };
}

export async function validateArcgisNormalizeSequenceOutputIntegrity(args: {
  readonly outputPath: string;
  readonly progress: NormalizeProgressRecord;
  readonly requireCompleteCount: boolean;
  readonly totalCount: number | null;
}): Promise<GeoJsonSequenceFileState> {
  const durableState = await inspectGeoJsonSequenceFileState(args.outputPath);
  if (durableState.outputBytes !== args.progress.outputBytes) {
    throw new Error(
      `Normalize progress outputBytes=${String(args.progress.outputBytes)} does not match durable bytes=${String(durableState.outputBytes)} for ${args.outputPath}`
    );
  }

  if (durableState.lineCount !== args.progress.writtenCount) {
    throw new Error(
      `Normalize progress writtenCount=${String(args.progress.writtenCount)} does not match durable line count=${String(durableState.lineCount)} for ${args.outputPath}`
    );
  }

  const expectedProcessedCount = args.progress.writtenCount + args.progress.skippedCount;
  if (args.progress.processedCount !== expectedProcessedCount) {
    throw new Error(
      `Normalize progress processedCount=${String(args.progress.processedCount)} does not equal writtenCount + skippedCount (${String(expectedProcessedCount)}) for ${args.outputPath}`
    );
  }

  if (
    args.requireCompleteCount &&
    args.totalCount !== null &&
    args.progress.processedCount !== args.totalCount
  ) {
    throw new Error(
      `Normalize progress processedCount=${String(args.progress.processedCount)} does not match expected featureCount=${String(args.totalCount)} for ${args.outputPath}`
    );
  }

  return durableState;
}

export async function reconcileArcgisNormalizeSequenceOutput(
  outputPath: string,
  resumeProgress: NormalizeProgressRecord | null
): Promise<NormalizeProgressRecord | null> {
  if (resumeProgress === null) {
    return null;
  }

  if (!existsSync(outputPath)) {
    if (resumeProgress.writtenCount === 0 && resumeProgress.outputBytes === 0) {
      const fileDescriptor = openSync(outputPath, "w");
      closeSync(fileDescriptor);
      return resumeProgress;
    }

    throw new Error(
      `Normalize progress exists for ${outputPath}, but the output file is missing while writtenCount=${String(resumeProgress.writtenCount)}.`
    );
  }

  if (resumeProgress.outputBytes > 0) {
    const currentSize = statSync(outputPath).size;
    if (currentSize < resumeProgress.outputBytes) {
      throw new Error(
        `Normalize progress expects ${String(resumeProgress.outputBytes)} bytes but output file only has ${String(currentSize)} bytes: ${outputPath}`
      );
    }

    truncateSync(outputPath, resumeProgress.outputBytes);
    return rebuildNormalizeProgressFromDurableOutput(
      resumeProgress,
      await inspectGeoJsonSequenceFileState(outputPath)
    );
  }

  await reconcileGeoJsonSequenceFileToLineCount(outputPath, resumeProgress.writtenCount);
  return rebuildNormalizeProgressFromDurableOutput(
    resumeProgress,
    await inspectGeoJsonSequenceFileState(outputPath)
  );
}

function appendArcgisNormalizePagePayload(
  outputFileDescriptor: number,
  outputPayload: string
): number {
  if (outputPayload.length === 0) {
    return 0;
  }

  const payloadBuffer = Buffer.from(outputPayload, "utf8");
  const bytesWritten = writeSync(outputFileDescriptor, payloadBuffer, 0, payloadBuffer.length);
  if (bytesWritten !== payloadBuffer.length) {
    throw new Error(
      `Failed to durably write the full normalize page payload (expected=${String(payloadBuffer.length)} wrote=${String(bytesWritten)}).`
    );
  }

  fsyncSync(outputFileDescriptor);
  return bytesWritten;
}

function commitArcgisNormalizeFeaturePage(args: {
  readonly outputFileDescriptor: number;
  readonly pageResult: ArcgisNormalizeFeaturePageResult;
  readonly sequenceArgs: ArcgisNormalizeSequenceArgs;
  readonly state: ArcgisNormalizeSequenceState;
}): void {
  const bytesWritten = appendArcgisNormalizePagePayload(
    args.outputFileDescriptor,
    args.pageResult.outputPayload
  );
  args.state.outputBytes += bytesWritten;
  args.state.lastObjectId = args.pageResult.lastObjectId;
  args.state.processedCount += args.pageResult.processedCountDelta;
  args.state.skippedCount += args.pageResult.skippedCountDelta;
  args.state.skippedObjectIds.push(...args.pageResult.skippedObjectIds);
  args.state.writtenCount += args.pageResult.writtenCountDelta;
  writeArcgisNormalizeSequenceCheckpoint(args.sequenceArgs, args.state);
}

async function writeArcgisNormalizedFloodGeojsonSequence(
  args: ArcgisNormalizeSequenceArgs
): Promise<void> {
  const resumeProgress = await reconcileArcgisNormalizeSequenceOutput(
    args.outputPath,
    readNormalizeProgress(args.progressPath)
  );
  const state = buildArcgisNormalizeSequenceState(resumeProgress);
  const outputFileDescriptor = openSync(args.outputPath, resumeProgress === null ? "w" : "a");

  try {
    writeArcgisNormalizeSequenceCheckpoint(args, state);

    while (true) {
      const page = await fetchArcgisFloodFeaturePage({
        lastObjectId: state.lastObjectId,
        pageSize: state.pageSize,
        sourceUrl: args.sourceUrl,
      });
      state.pageSize = page.pageSize;

      if (page.features.length === 0) {
        break;
      }

      const pageResult = await processArcgisNormalizeFeaturePage({
        attributeFeatures: page.features,
        sequenceArgs: args,
        state,
      });
      commitArcgisNormalizeFeaturePage({
        outputFileDescriptor,
        pageResult,
        sequenceArgs: args,
        state,
      });

      console.log(
        buildNormalizeSummary(
          state.writtenCount,
          state.processedCount,
          args.totalCount,
          state.lastObjectId,
          state.pageSize,
          state.skippedCount
        )
      );
    }
  } finally {
    closeSync(outputFileDescriptor);
  }

  const committedProgress = readNormalizeProgress(args.progressPath);
  if (committedProgress === null) {
    throw new Error(
      `Missing normalize progress checkpoint after ArcGIS normalize: ${args.progressPath}`
    );
  }

  await validateArcgisNormalizeSequenceOutputIntegrity({
    outputPath: args.outputPath,
    progress: committedProgress,
    requireCompleteCount: true,
    totalCount: args.totalCount,
  });
}

async function runLocalNormalizeProgressSync(args: {
  readonly activeStatusPath: string;
  readonly progressPath: string;
  readonly runId: string;
  readonly sequencePath: string;
  readonly totalCount: number | null;
}): Promise<void> {
  const existing = readNormalizeProgress(args.progressPath);
  const growth = await inspectGeoJsonSequenceGrowth(args.sequencePath, existing?.outputBytes ?? 0);
  const writtenCount = (existing?.writtenCount ?? 0) + growth.lineCountDelta;

  writeNormalizeCheckpoint({
    activeStatusPath: args.activeStatusPath,
    geometryBatchSize: MAPSERVER_GEOMETRY_BATCH_SIZE,
    lastObjectId: null,
    outputBytes: growth.outputBytes,
    pageSize: 0,
    processedCount: writtenCount,
    progressPath: args.progressPath,
    runId: args.runId,
    skippedObjectIds: [],
    skippedCount: 0,
    totalCount: args.totalCount,
    writtenCount,
  });
}

async function writeLocalNormalizedFloodGeojsonSequence(args: {
  readonly activeStatusPath: string;
  readonly ogrDataSourcePath: string;
  readonly progressPath: string;
  readonly runId: string;
  readonly sequencePath: string;
  readonly sql: string;
  readonly totalCount: number | null;
}): Promise<void> {
  rmSync(args.sequencePath, { force: true });
  rmSync(args.progressPath, { force: true });

  writeNormalizeCheckpoint({
    activeStatusPath: args.activeStatusPath,
    geometryBatchSize: MAPSERVER_GEOMETRY_BATCH_SIZE,
    lastObjectId: null,
    outputBytes: 0,
    pageSize: 0,
    processedCount: 0,
    progressPath: args.progressPath,
    runId: args.runId,
    skippedObjectIds: [],
    skippedCount: 0,
    totalCount: args.totalCount,
    writtenCount: 0,
  });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ogr2ogr",
      [
        "-f",
        "GeoJSONSeq",
        args.sequencePath,
        args.ogrDataSourcePath,
        "-dialect",
        "SQLite",
        "-sql",
        args.sql,
        "-nlt",
        "PROMOTE_TO_MULTI",
        "-lco",
        "RS=NO",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let syncPending = false;
    let syncQueued = false;

    const syncProgress = (): void => {
      if (syncPending) {
        syncQueued = true;
        return;
      }

      syncPending = true;
      runLocalNormalizeProgressSync({
        activeStatusPath: args.activeStatusPath,
        progressPath: args.progressPath,
        runId: args.runId,
        sequencePath: args.sequencePath,
        totalCount: args.totalCount,
      })
        .catch((error) => {
          console.warn(
            `Flood local normalize progress sync failed for ${args.sequencePath}: ${String(
              error instanceof Error ? error.message : error
            )}`
          );
        })
        .finally(() => {
          syncPending = false;
          if (syncQueued) {
            syncQueued = false;
            syncProgress();
          }
        });
    };

    const interval = setInterval(syncProgress, LOCAL_NORMALIZE_PROGRESS_INTERVAL_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdoutChunks.push(chunk);
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      clearInterval(interval);
      reject(error);
    });

    child.on("close", (code) => {
      clearInterval(interval);
      runLocalNormalizeProgressSync({
        activeStatusPath: args.activeStatusPath,
        progressPath: args.progressPath,
        runId: args.runId,
        sequencePath: args.sequencePath,
        totalCount: args.totalCount,
      })
        .then(async () => {
          const committedProgress = readNormalizeProgress(args.progressPath);
          if (committedProgress === null) {
            throw new Error(
              `Missing normalize progress checkpoint after local flood normalize: ${args.progressPath}`
            );
          }

          await validateArcgisNormalizeSequenceOutputIntegrity({
            outputPath: args.sequencePath,
            progress: committedProgress,
            requireCompleteCount: true,
            totalCount: args.totalCount,
          });
        })
        .then(() => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              [
                `ogr2ogr exited with code ${String(code ?? "null")}`,
                stdoutChunks.join("").trim(),
                stderrChunks.join("").trim(),
              ]
                .filter((value) => value.length > 0)
                .join("\n")
            )
          );
        })
        .catch(reject);
    });
  });
}

function resolveNormalizedFloodPath(normalizedDir: string): string {
  const sequencePath = join(normalizedDir, GEOJSON_SEQUENCE_FILE_NAME);
  if (existsSync(sequencePath)) {
    return sequencePath;
  }

  return join(normalizedDir, GEOJSON_FILE_NAME);
}

function isArcgisFloodLayerUrl(value: string | null): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/")
  );
}

function resolveConfiguredFloodSourceUrl(): string | null {
  const explicitUrl =
    parseArg("--source-url") ?? process.env.ENVIRONMENTAL_FLOOD_SOURCE_URL ?? null;
  if (typeof explicitUrl === "string" && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }

  return DEFAULT_FEMA_FLOOD_LAYER_URL;
}

function readGeoJsonFeatures(value: unknown): readonly ArcgisGeoJsonFeature[] | null {
  if (typeof value !== "object" || value === null || !("features" in value)) {
    return null;
  }

  const rawFeatures = Reflect.get(value, "features");
  if (!Array.isArray(rawFeatures)) {
    return null;
  }

  const features: ArcgisGeoJsonFeature[] = [];
  for (const rawFeature of rawFeatures) {
    if (
      typeof rawFeature !== "object" ||
      rawFeature === null ||
      Reflect.get(rawFeature, "type") !== "Feature"
    ) {
      return null;
    }

    features.push(rawFeature as ArcgisGeoJsonFeature);
  }

  return features;
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null;
  if (typeof databaseUrl !== "string" || databaseUrl.trim().length === 0) {
    throw new Error("Missing DATABASE_URL or POSTGRES_URL for environmental flood load step.");
  }

  return databaseUrl.trim();
}

function quotePgConnectionValue(value: string): string {
  return value.replaceAll("'", "\\'");
}

function toOgrPostgresConnectionString(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(LEADING_SLASH_PATTERN, "");
  if (databaseName.length === 0) {
    throw new Error("Database URL is missing a database name.");
  }

  const parts = [`dbname='${quotePgConnectionValue(databaseName)}'`];

  if (parsed.hostname.length > 0) {
    parts.push(`host='${quotePgConnectionValue(parsed.hostname)}'`);
  }

  if (parsed.port.length > 0) {
    parts.push(`port='${quotePgConnectionValue(parsed.port)}'`);
  }

  if (parsed.username.length > 0) {
    parts.push(`user='${quotePgConnectionValue(decodeURIComponent(parsed.username))}'`);
  }

  if (parsed.password.length > 0) {
    parts.push(`password='${quotePgConnectionValue(decodeURIComponent(parsed.password))}'`);
  }

  const sslMode = parsed.searchParams.get("sslmode");
  if (typeof sslMode === "string" && sslMode.trim().length > 0) {
    parts.push(`sslmode='${quotePgConnectionValue(sslMode.trim())}'`);
  }

  return `PG:${parts.join(" ")}`;
}

function currentStep(): string {
  return requireArg("--step");
}

function resolveFloodLoadSourcePath(defaultPath: string): string {
  const explicitPath =
    parseArg("--load-source-path") ?? process.env.ENVIRONMENTAL_FLOOD_LOAD_SOURCE_PATH ?? null;
  if (typeof explicitPath === "string" && explicitPath.trim().length > 0) {
    return explicitPath.trim();
  }

  return defaultPath;
}

function resolveFloodLoadSourceLayer(): string | null {
  const explicitLayer =
    parseArg("--load-source-layer") ?? process.env.ENVIRONMENTAL_FLOOD_LOAD_SOURCE_LAYER ?? null;
  if (typeof explicitLayer === "string" && explicitLayer.trim().length > 0) {
    return explicitLayer.trim();
  }

  return null;
}

function isMbtilesPath(sourcePath: string): boolean {
  return sourcePath.toLowerCase().endsWith(".mbtiles");
}

function isGeoJsonSequencePath(sourcePath: string): boolean {
  const normalized = sourcePath.toLowerCase();
  return (
    normalized.endsWith(".geojsonl") ||
    normalized.endsWith(".geojsonseq") ||
    normalized.endsWith(".ndjson")
  );
}

function buildFloodLoadCommandArgs(args: {
  readonly append?: boolean;
  readonly loadSourceDialect?: string;
  readonly loadSourceGeometryOptions?: readonly string[];
  readonly loadSourceLayer: string | null;
  readonly loadSourcePath: string;
  readonly loadSourceSql?: string;
  readonly ogrPostgresConnectionString: string;
}): string[] {
  const { loadSourceLayer, loadSourcePath } = args;
  const loadSourceSrid = isMbtilesPath(loadSourcePath) ? "EPSG:3857" : "EPSG:4326";
  const commonArgs = [
    "-f",
    "PostgreSQL",
    args.ogrPostgresConnectionString,
    ...(isGeoJsonSequencePath(loadSourcePath) ? ["-if", "GeoJSONSeq"] : []),
    loadSourcePath,
    ...(args.append === true ? ["-append"] : ["-overwrite"]),
    "-nln",
    FLOOD_STAGE_TABLE_NAME,
    "-lco",
    "GEOMETRY_NAME=geom",
    "-lco",
    "FID=ogr_fid",
    ...(args.loadSourceGeometryOptions ?? ["-nlt", "PROMOTE_TO_MULTI"]),
    "-a_srs",
    loadSourceSrid,
    "-gt",
    "65536",
  ];

  if (typeof args.loadSourceSql === "string" && args.loadSourceSql.length > 0) {
    return [
      ...commonArgs,
      "-dialect",
      args.loadSourceDialect ?? "SQLite",
      "-sql",
      args.loadSourceSql,
    ];
  }

  if (isMbtilesPath(loadSourcePath)) {
    return [
      ...commonArgs,
      "-sql",
      `SELECT *
FROM "flood-hazard"
WHERE OGR_GEOMETRY = 'POLYGON' OR OGR_GEOMETRY = 'MULTIPOLYGON'`,
    ];
  }

  return [
    ...commonArgs.slice(0, 4),
    ...(typeof loadSourceLayer === "string" ? [loadSourceLayer] : []),
    ...commonArgs.slice(4),
  ];
}

function resolveFieldNames(
  dataSourcePath: string,
  layerName: string
): {
  readonly dfirmIdField: string | null;
  readonly fldZoneField: string;
  readonly sfhaField: string | null;
  readonly sourceCitationField: string | null;
  readonly zoneSubtypeField: string | null;
} {
  const fieldNames = readOgrFieldNames(dataSourcePath, layerName);
  return {
    dfirmIdField: resolveOgrFieldName(fieldNames, ["DFIRM_ID"], false),
    fldZoneField: resolveOgrFieldName(fieldNames, ["FLD_ZONE", "ZONE"], true) ?? "FLD_ZONE",
    sfhaField: resolveOgrFieldName(fieldNames, ["SFHA_TF"], false),
    sourceCitationField: resolveOgrFieldName(fieldNames, ["SOURCE_CIT"], false),
    zoneSubtypeField: resolveOgrFieldName(fieldNames, ["ZONE_SUBTY", "ZONE_SUBTYPE"], false),
  };
}

function sqlTextExpression(fieldName: string | null): string {
  if (fieldName === null) {
    return "CAST(NULL AS TEXT)";
  }

  return `CAST(${quoteSqlIdentifier(fieldName)} AS TEXT)`;
}

function sqlUpperTextExpression(fieldName: string | null): string {
  return `UPPER(${sqlTextExpression(fieldName)})`;
}

function sqlUpperTrimTextExpression(fieldName: string | null): string {
  return `UPPER(TRIM(${sqlTextExpression(fieldName)}))`;
}

function buildLocalSourceFloodSql(args: {
  readonly dataVersion: string;
  readonly fieldNames: ReturnType<typeof resolveFieldNames>;
  readonly geometryField: string;
  readonly layerName: string;
}): string {
  const fldZoneExpression = sqlUpperTextExpression(args.fieldNames.fldZoneField);
  const zoneSubtypeExpression = sqlUpperTextExpression(args.fieldNames.zoneSubtypeField);
  const sfhaExpression = sqlUpperTrimTextExpression(args.fieldNames.sfhaField);
  const isFlood100Condition = `(${sfhaExpression} IN ('T', 'TRUE', 'Y') OR ${fldZoneExpression} IN (${STRICT_FLOOD_100_ZONE_SQL}))`;
  const isFlood500Condition = `(NOT ${isFlood100Condition} AND ${fldZoneExpression} = 'X' AND ${zoneSubtypeExpression} LIKE '%0.2%')`;

  return [
    "SELECT",
    `${sqlTextExpression(args.fieldNames.dfirmIdField)} AS DFIRM_ID,`,
    `${fldZoneExpression} AS FLD_ZONE,`,
    `${zoneSubtypeExpression} AS ZONE_SUBTY,`,
    `${sfhaExpression} AS SFHA_TF,`,
    `${sqlTextExpression(args.fieldNames.sourceCitationField)} AS SOURCE_CIT,`,
    `CASE WHEN ${isFlood100Condition} THEN 1 ELSE 0 END AS is_flood_100,`,
    `CASE WHEN ${isFlood500Condition} THEN 1 ELSE 0 END AS is_flood_500,`,
    "CASE",
    `  WHEN ${isFlood100Condition} THEN 'flood-100'`,
    `  WHEN ${isFlood500Condition} THEN 'flood-500'`,
    `  ELSE 'other'`,
    "END AS flood_band,",
    "CASE",
    `  WHEN ${isFlood100Condition} THEN 'flood-100'`,
    `  WHEN ${isFlood500Condition} THEN 'flood-500'`,
    `  ELSE 'other'`,
    "END AS legend_key,",
    `${quoteSqlString(args.dataVersion)} AS data_version,`,
    `${quoteSqlIdentifier(args.geometryField)} AS geometry`,
    `FROM ${quoteSqlIdentifier(args.layerName)}`,
    `WHERE ${isFlood100Condition} OR ${isFlood500Condition}`,
  ].join(" ");
}

function resolveLocalFloodStateSourceMetadata(
  source: LocalFloodStateSource
): LocalFloodStateSourceMetadata {
  const geometryField = readOgrGeometryFieldName(source.dataSourcePath, source.layerName);
  const fieldNames = resolveFieldNames(source.dataSourcePath, source.layerName);
  const filteredFeatureCount = readOgrFeatureCount(source.dataSourcePath, source.layerName);
  if (filteredFeatureCount === null) {
    throw new Error(`Unable to read OGR feature count for ${source.dataSourcePath}`);
  }

  return {
    fieldNames,
    filteredFeatureCount,
    geometryField,
  };
}

function loadLocalFloodStateSources(args: {
  readonly context: ReturnType<typeof resolveRunContext>;
  readonly databaseUrl: string;
  readonly ogrPostgresConnectionString: string;
  readonly runConfig: RunConfigRecord;
}): {
  readonly loadSourceAppend: boolean;
  readonly loadSourceDialect: string;
  readonly loadSourceGeometryOptions: readonly string[];
  readonly loadSourceLayer: null;
  readonly loadSourcePath: string;
  readonly loadSourceSql: string;
  readonly loadSourceSrid: 4326;
} {
  const materializedSourceName = args.runConfig.options.materializedSourceName;
  const layerName = args.runConfig.options.layerName;
  if (typeof materializedSourceName !== "string" || materializedSourceName.length === 0) {
    throw new Error(`Missing materializedSourceName in ${args.context.runConfigPath}`);
  }

  if (typeof layerName !== "string" || layerName.length === 0) {
    throw new Error(`Missing layerName in ${args.context.runConfigPath}`);
  }

  const localSourcePath = join(args.context.rawDir, materializedSourceName);
  const sourceRootPath = args.runConfig.sourcePath ?? localSourcePath;
  const sourceRootDir = dirname(sourceRootPath);
  const stateSources = listLocalFloodStateSources(sourceRootDir, layerName);
  const loadProgressPath = join(args.context.runDir, LOAD_PROGRESS_FILE_NAME);
  const loadProgress = readFloodLoadProgress(loadProgressPath);
  const completedSourceIds = new Set(loadProgress?.completedSourceIds ?? []);
  let completedStateCount = completedSourceIds.size;
  const completedSourceRowCounts = new Map<string, number>(
    Object.entries(loadProgress?.completedSourceRowCounts ?? {})
  );
  const sourceMetadataCache = new Map<string, LocalFloodStateSourceMetadata>();
  const resolveSourceMetadata = (source: LocalFloodStateSource): LocalFloodStateSourceMetadata => {
    const cachedMetadata = sourceMetadataCache.get(source.sourceId);
    if (typeof cachedMetadata !== "undefined") {
      return cachedMetadata;
    }

    const metadata = resolveLocalFloodStateSourceMetadata(source);
    sourceMetadataCache.set(source.sourceId, metadata);
    return metadata;
  };
  const stageTableReady = floodTableExists(args.databaseUrl, FLOOD_STAGE_TABLE_NAME);
  if (!stageTableReady) {
    completedSourceIds.clear();
    completedSourceRowCounts.clear();
    completedStateCount = 0;
  }

  let loadedRowCount = stageTableReady ? queryFloodStageRowCount(args.databaseUrl) : 0;
  const totalCount = readFloodFeatureCount(args.context.runSummaryPath);
  const totalStateCount = stateSources.length;

  for (const stateSource of stateSources) {
    if (completedSourceIds.has(stateSource.sourceId)) {
      continue;
    }

    const sourceMetadata = resolveSourceMetadata(stateSource);

    writeFloodLoadProgress(loadProgressPath, {
      completedSourceIds: [...completedSourceIds],
      completedSourceRowCounts: Object.fromEntries(completedSourceRowCounts),
      currentSourceId: stateSource.sourceId,
      currentStateLabel: stateSource.stateLabel,
      loadedRowCount,
      totalSourceCount: totalStateCount,
      updatedAt: formatIsoTimestamp(new Date()),
    });
    writeFloodActiveStatus({
      activeStatusPath: join(args.context.runDir, "active-run.json"),
      phase: "loading",
      runId: args.context.runId,
      summary: buildLoadSummary({
        completedStateCount,
        currentStateLabel: stateSource.stateLabel,
        loadedRowCount,
        stageMegabytes: queryFloodStageMegabytes(args.databaseUrl),
        totalCount,
        totalStateCount,
      }),
    });

    const stageRowCountBefore = loadedRowCount;
    runCommand(
      "ogr2ogr",
      buildFloodLoadCommandArgs({
        append: completedStateCount > 0,
        loadSourceDialect: "SQLite",
        loadSourceGeometryOptions: ["-nlt", "GEOMETRY", "-nlt", "CONVERT_TO_LINEAR", "-makevalid"],
        loadSourceLayer: null,
        loadSourcePath: stateSource.dataSourcePath,
        loadSourceSql: buildLocalSourceFloodSql({
          dataVersion: args.runConfig.dataVersion,
          fieldNames: sourceMetadata.fieldNames,
          geometryField: sourceMetadata.geometryField,
          layerName: stateSource.layerName,
        }),
        ogrPostgresConnectionString: args.ogrPostgresConnectionString,
      }),
      {
        env: {
          OGR_GEOJSON_MAX_OBJ_SIZE: "0",
          PG_USE_COPY: "YES",
        },
      }
    );

    completedSourceIds.add(stateSource.sourceId);
    completedStateCount += 1;
    loadedRowCount = queryFloodStageRowCount(args.databaseUrl);
    completedSourceRowCounts.set(
      stateSource.sourceId,
      Math.max(0, loadedRowCount - stageRowCountBefore)
    );
    writeFloodLoadProgress(loadProgressPath, {
      completedSourceIds: [...completedSourceIds],
      completedSourceRowCounts: Object.fromEntries(completedSourceRowCounts),
      currentSourceId: null,
      currentStateLabel: null,
      loadedRowCount,
      materializeExpectedCount: undefined,
      materializeProcessedRowCount: undefined,
      materializeRangeEnd: undefined,
      totalSourceCount: totalStateCount,
      updatedAt: formatIsoTimestamp(new Date()),
    });
    writeFloodActiveStatus({
      activeStatusPath: join(args.context.runDir, "active-run.json"),
      phase: "loading",
      runId: args.context.runId,
      summary: buildLoadSummary({
        completedStateCount,
        currentStateLabel: stateSource.stateLabel,
        loadedRowCount,
        stageMegabytes: queryFloodStageMegabytes(args.databaseUrl),
        totalCount,
        totalStateCount,
      }),
    });
  }

  const actualStageRowCount = queryFloodStageRowCount(args.databaseUrl);
  writeFloodLoadProgress(loadProgressPath, {
    completedSourceIds: [...completedSourceIds],
    completedSourceRowCounts: Object.fromEntries(completedSourceRowCounts),
    currentSourceId: null,
    currentStateLabel: null,
    loadedRowCount: actualStageRowCount,
    materializeExpectedCount: actualStageRowCount,
    materializeProcessedRowCount: 0,
    materializeRangeEnd: 0,
    totalSourceCount: totalStateCount,
    updatedAt: formatIsoTimestamp(new Date()),
  });
  writeFloodActiveStatus({
    activeStatusPath: join(args.context.runDir, "active-run.json"),
    phase: "loading",
    runId: args.context.runId,
    summary: buildLoadSummary({
      completedStateCount,
      currentStateLabel: null,
      loadedRowCount: actualStageRowCount,
      stageMegabytes: queryFloodStageMegabytes(args.databaseUrl),
      totalCount: actualStageRowCount,
      totalStateCount,
    }),
  });

  const lastState = stateSources.at(-1);
  if (typeof lastState === "undefined") {
    throw new Error("No FEMA state sources were available for direct flood loading.");
  }

  const finalGeometryField = readOgrGeometryFieldName(
    lastState.dataSourcePath,
    lastState.layerName
  );
  const finalFieldNames = resolveFieldNames(lastState.dataSourcePath, lastState.layerName);
  return {
    loadSourceAppend: true,
    loadSourceDialect: "SQLite",
    loadSourceGeometryOptions: ["-nlt", "GEOMETRY", "-nlt", "CONVERT_TO_LINEAR", "-makevalid"],
    loadSourceLayer: null,
    loadSourcePath: lastState.dataSourcePath,
    loadSourceSql: buildLocalSourceFloodSql({
      dataVersion: args.runConfig.dataVersion,
      fieldNames: finalFieldNames,
      geometryField: finalGeometryField,
      layerName: lastState.layerName,
    }),
    loadSourceSrid: 4326,
  };
}

function readRunConfig(path: string): RunConfigRecord {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof parsed.runId !== "string" ||
    typeof parsed.dataset !== "string" ||
    typeof parsed.dataVersion !== "string"
  ) {
    throw new Error(`Invalid run config: ${path}`);
  }

  const options =
    typeof parsed.options === "object" && parsed.options !== null && !Array.isArray(parsed.options)
      ? Object.entries(parsed.options).reduce<Record<string, string>>((result, entry) => {
          const [key, value] = entry;
          if (typeof value === "string") {
            result[key] = value;
          }
          return result;
        }, {})
      : {};

  const sourcePath = typeof parsed.sourcePath === "string" ? parsed.sourcePath : undefined;
  const sourceUrl = typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : undefined;

  return {
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    dataVersion: parsed.dataVersion,
    dataset:
      parsed.dataset === "environmental-hydro-basins"
        ? "environmental-hydro-basins"
        : "environmental-flood",
    options,
    runId: parsed.runId,
    ...(typeof sourcePath === "string" ? { sourcePath } : {}),
    ...(typeof sourceUrl === "string" ? { sourceUrl } : {}),
  };
}

async function extractStep(): Promise<void> {
  const context = resolveRunContext("environmental-flood", import.meta.url);
  ensureRunDirectories(context);

  const sourcePath =
    parseArg("--source-path") ?? process.env.ENVIRONMENTAL_FLOOD_SOURCE_PATH ?? null;
  const sourceUrl = sourcePath === null ? resolveConfiguredFloodSourceUrl() : null;
  const dataVersion =
    parseArg("--data-version") ?? process.env.ENVIRONMENTAL_FLOOD_DATA_VERSION ?? context.runId;
  const sourceLayer =
    parseArg("--source-layer") ?? process.env.ENVIRONMENTAL_FLOOD_SOURCE_LAYER ?? null;

  verifyRunConfig(context.runConfigPath, {
    dataVersion,
    dataset: context.dataset,
    options: {
      sourceLayer: sourceLayer ?? "",
    },
    runId: context.runId,
    sourcePath,
    sourceUrl,
  });

  if (sourcePath === null && isArcgisFloodLayerUrl(sourceUrl)) {
    const featureCount = await queryArcgisFloodFeatureCount(sourceUrl);
    writeRunConfig(context.runConfigPath, {
      dataVersion,
      dataset: context.dataset,
      options: {
        sourceLayer: sourceLayer ?? "",
        sourceLayerUrl: sourceUrl,
      },
      runId: context.runId,
      sourcePath: null,
      sourceUrl,
    });
    writeJsonFile(context.runSummaryPath, {
      completedAt: new Date().toISOString(),
      dataVersion,
      dataset: context.dataset,
      featureCount,
      layerName: "Flood Hazard Zones",
      runId: context.runId,
      sourcePath: null,
      sourceUrl,
    });
    return;
  }

  const materializedSource = materializeSource(
    context.rawDir,
    sourcePath,
    sourceUrl,
    "nfhl-source"
  );
  const ogrDataSourcePath = resolveOgrDataSourcePath(materializedSource.localPath);
  const layerName = resolveOgrLayerName(ogrDataSourcePath, sourceLayer, ["S_Fld_Haz_Ar"]);

  writeRunConfig(context.runConfigPath, {
    dataVersion,
    dataset: context.dataset,
    options: {
      layerName,
      materializedSourceName: basename(materializedSource.localPath),
      normalizeStrategy: LOCAL_FLOOD_NORMALIZE_STRATEGY,
      sourceLayer: sourceLayer ?? "",
    },
    runId: context.runId,
    sourcePath: materializedSource.sourcePath,
    sourceUrl: materializedSource.sourceUrl,
  });
  writeJsonFile(context.runSummaryPath, {
    completedAt: new Date().toISOString(),
    dataVersion,
    dataset: context.dataset,
    featureCount: readOgrFeatureCount(ogrDataSourcePath, layerName),
    layerName,
    runId: context.runId,
    sourcePath: materializedSource.sourcePath,
    sourceUrl: materializedSource.sourceUrl,
  });
}

async function normalizeStep(): Promise<void> {
  const context = resolveRunContext("environmental-flood", import.meta.url);
  const runConfig = readRunConfig(context.runConfigPath);
  const dataVersion = runConfig.dataVersion;
  const materializedSourceName = runConfig.options.materializedSourceName;
  const layerName = runConfig.options.layerName;
  const normalizeStrategy = runConfig.options.normalizeStrategy;
  const sourceLayerUrl = runConfig.options.sourceLayerUrl;
  const totalCount = readFloodFeatureCount(context.runSummaryPath);

  if (isArcgisFloodLayerUrl(sourceLayerUrl)) {
    await writeArcgisNormalizedFloodGeojsonSequence({
      activeStatusPath: join(context.runDir, "active-run.json"),
      dataVersion,
      outputPath: join(context.normalizedDir, GEOJSON_SEQUENCE_FILE_NAME),
      progressPath: join(context.runDir, NORMALIZE_PROGRESS_FILE_NAME),
      runId: context.runId,
      sourceUrl: sourceLayerUrl,
      totalCount,
    });
    return;
  }

  if (typeof materializedSourceName !== "string" || materializedSourceName.length === 0) {
    throw new Error(`Missing materializedSourceName in ${context.runConfigPath}`);
  }

  if (typeof layerName !== "string" || layerName.length === 0) {
    throw new Error(`Missing layerName in ${context.runConfigPath}`);
  }

  const localSourcePath = join(context.rawDir, materializedSourceName);
  const ogrDataSourcePath = resolveOgrDataSourcePath(localSourcePath);
  const geometryField = readOgrGeometryFieldName(ogrDataSourcePath, layerName);
  const fieldNames = resolveFieldNames(ogrDataSourcePath, layerName);
  if (normalizeStrategy === LOCAL_FLOOD_NORMALIZE_STRATEGY) {
    writeNormalizeCheckpoint({
      activeStatusPath: join(context.runDir, "active-run.json"),
      geometryBatchSize: MAPSERVER_GEOMETRY_BATCH_SIZE,
      lastObjectId: null,
      outputKind: LOCAL_FLOOD_NORMALIZE_STRATEGY,
      outputBytes: 0,
      pageSize: 0,
      processedCount: totalCount ?? 0,
      progressPath: join(context.runDir, NORMALIZE_PROGRESS_FILE_NAME),
      runId: context.runId,
      skippedObjectIds: [],
      skippedCount: 0,
      totalCount,
      writtenCount: totalCount ?? 0,
    });
    return;
  }

  await writeLocalNormalizedFloodGeojsonSequence({
    activeStatusPath: join(context.runDir, "active-run.json"),
    ogrDataSourcePath,
    progressPath: join(context.runDir, NORMALIZE_PROGRESS_FILE_NAME),
    runId: context.runId,
    sequencePath: join(context.normalizedDir, GEOJSON_SEQUENCE_FILE_NAME),
    sql: buildLocalSourceFloodSql({
      dataVersion,
      fieldNames,
      geometryField,
      layerName,
    }),
    totalCount,
  });
}

async function loadStep(): Promise<void> {
  const context = resolveRunContext("environmental-flood", import.meta.url);
  const runConfig = readRunConfig(context.runConfigPath);
  const normalizeStrategy = runConfig.options.normalizeStrategy;
  const sequencePath = join(context.normalizedDir, GEOJSON_SEQUENCE_FILE_NAME);
  if (existsSync(sequencePath)) {
    const normalizeProgress = readNormalizeProgress(
      join(context.runDir, NORMALIZE_PROGRESS_FILE_NAME)
    );
    if (normalizeProgress === null) {
      throw new Error(
        `Missing normalize progress checkpoint for ArcGIS flood load: ${join(context.runDir, NORMALIZE_PROGRESS_FILE_NAME)}`
      );
    }

    await validateArcgisNormalizeSequenceOutputIntegrity({
      outputPath: sequencePath,
      progress: normalizeProgress,
      requireCompleteCount: true,
      totalCount: readFloodFeatureCount(context.runSummaryPath),
    });
  }

  const loadSourceLayer = resolveFloodLoadSourceLayer();
  const databaseUrl = requireDatabaseUrl();
  const schemaPath = join(
    resolveProjectRoot(import.meta.url),
    "scripts",
    "sql",
    "environmental-flood-schema.sql"
  );
  const ogrPostgresConnectionString = toOgrPostgresConnectionString(databaseUrl);

  runCommand("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", schemaPath]);

  const normalizedFloodPath =
    normalizeStrategy === LOCAL_FLOOD_NORMALIZE_STRATEGY
      ? null
      : resolveNormalizedFloodPath(context.normalizedDir);
  let loadSourcePath =
    normalizedFloodPath === null ? "" : resolveFloodLoadSourcePath(normalizedFloodPath);
  let effectiveLoadSourceLayer = loadSourceLayer;
  let loadSourceGeometryOptions: readonly string[] | undefined;
  let loadSourceSql: string | undefined;
  let loadSourceDialect: string | undefined;
  let loadSourceAppend = false;
  let loadSourceSrid = isMbtilesPath(loadSourcePath) ? 3857 : 4326;

  if (normalizeStrategy === LOCAL_FLOOD_NORMALIZE_STRATEGY) {
    const localLoadSource = loadLocalFloodStateSources({
      context,
      databaseUrl,
      ogrPostgresConnectionString,
      runConfig,
    });
    loadSourcePath = localLoadSource.loadSourcePath;
    effectiveLoadSourceLayer = localLoadSource.loadSourceLayer;
    loadSourceAppend = localLoadSource.loadSourceAppend;
    loadSourceGeometryOptions = localLoadSource.loadSourceGeometryOptions;
    loadSourceDialect = localLoadSource.loadSourceDialect;
    loadSourceSql = localLoadSource.loadSourceSql;
    loadSourceSrid = localLoadSource.loadSourceSrid;
  } else {
    loadSourceSrid = isMbtilesPath(loadSourcePath) ? 3857 : 4326;
  }
  if (normalizeStrategy !== LOCAL_FLOOD_NORMALIZE_STRATEGY) {
    runCommand(
      "ogr2ogr",
      buildFloodLoadCommandArgs({
        append: loadSourceAppend,
        loadSourceDialect,
        loadSourceGeometryOptions,
        loadSourceLayer: effectiveLoadSourceLayer,
        loadSourcePath,
        loadSourceSql,
        ogrPostgresConnectionString,
      }),
      {
        env: {
          OGR_GEOJSON_MAX_OBJ_SIZE: "0",
          PG_USE_COPY: "YES",
        },
      }
    );
  }

  const sourcePath = runConfig.sourcePath ?? "";
  const sourceUrl = runConfig.sourceUrl ?? "";
  const notes = JSON.stringify({
    dataset: runConfig.dataset,
    loadSourcePath,
    loadSourceSrid,
    normalizedSource: normalizedFloodPath,
  });
  await materializeFloodCanonicalTable({
    activeStatusPath: join(context.runDir, "active-run.json"),
    context,
    databaseUrl,
    loadSourceSrid,
    notes,
    runConfig,
    sourcePath,
    sourceUrl,
  });
}

async function main(): Promise<void> {
  const step = currentStep();
  if (step === "extract") {
    await extractStep();
  } else if (step === "normalize") {
    await normalizeStep();
  } else if (step === "load") {
    await loadStep();
  } else {
    throw new Error(`Unsupported step: ${step}`);
  }
}

if (import.meta.main) {
  await main();
}
