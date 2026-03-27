import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runBufferedCommand } from "./command-runner";
import { runDuckDbCli } from "./duckdb-runner";
import type {
  EnvironmentalPlanetilerInputContext,
  FloodPlanetilerInputSpec,
  FloodPlanetilerOverlayKind,
  FloodPlanetilerOverlayOutput,
  FloodPlanetilerPackagingProgress,
  HydroPlanetilerInputSpec,
  HydroPlanetilerOutput,
  WriteFloodPlanetilerInputsArgs,
  WriteHydroPlanetilerInputsArgs,
} from "./environmental-planetiler-inputs.types";

const SQL_STRING_ESCAPE_RE = /'/g;
const JSON_PAYLOAD_START_RE = /\[|{/;
const DUCKDB_JSON_CAPTURE_MAX_BYTES = 8_000_000;
const PARQUET_GLOB = "part-*.parquet";
const FLOOD_DISSOLVED_LAYER_NAME = "flood_overlay_dissolved";
const FLOOD_EXPORT_BUCKET_COUNT = 64;
const FLOOD_EXPORT_MEMORY_LIMIT = "3GB";
const FLOOD_EXPORT_MAX_TEMP_DIRECTORY_SIZE = "24GB";
const FLOOD_RAW_BUCKET_MEMORY_LIMIT = "5GB";
const FLOOD_RAW_BUCKET_MAX_TEMP_DIRECTORY_SIZE = "96GB";
const FLOOD_PLANETILER_LAYER_NAME = "flood_overlay";
const FLOOD_PLANETILER_SRID = "EPSG:3857";
const FLOOD_SUBDIVIDE_VERTICES = 255;
const FLOOD_DISSOLVE_AGGREGATE = "ST_Union_Agg";
const FLOOD_BUCKET_FILENAME_PATTERN = "part-{i}";
const FLOOD_BUCKET_PROFILE_VERSION = "flood-planetiler-bucket-profile-v1";
const FLOOD_PACKAGE_CHUNK_SIZE = 64;
const FLOOD_PACKAGE_CONCURRENCY = 4;
const FLOOD_PACKAGE_PROGRESS_VERSION = "flood-planetiler-package-progress-v1";
const FLOOD_PACKAGE_SQLITE_CACHE_MB = "1024";
const FLOOD_PACKAGE_SQLITE_JOURNAL_MODE = "MEMORY";
const FLOOD_PACKAGE_SQLITE_PRAGMA = "locking_mode=EXCLUSIVE,temp_store=MEMORY";
const FLOOD_BUCKET_SEPARATOR = "\u001e";

interface FloodBucketMetrics {
  readonly inputDfirmIdCount: number;
  readonly inputGroupCount: number;
  readonly inputRowCount: number;
  readonly outputRowCount: number;
}

interface FloodBucketProfile {
  readonly bucketIndex: number;
  readonly durationMs: number;
  readonly inputDfirmIdCount: number;
  readonly inputGroupCount: number;
  readonly inputRowCount: number;
  readonly outputBytes: number;
  readonly outputRowCount: number;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly tempDirectoryBytes: number;
}

interface FloodPackagingSourceStats {
  readonly maxFid: number;
  readonly minFid: number;
  readonly rowCount: number;
}

interface FloodPackagingChunkPlan {
  readonly chunkIndex: number;
  readonly maxFid: number;
  readonly minFid: number;
  readonly rowCount: number;
}

const HYDRO_OUTPUT_MATRIX: readonly Pick<HydroPlanetilerOutput, "featureKind" | "hucLevel">[] = [
  { featureKind: "polygon", hucLevel: 4 },
  { featureKind: "line", hucLevel: 4 },
  { featureKind: "label", hucLevel: 4 },
  { featureKind: "polygon", hucLevel: 6 },
  { featureKind: "line", hucLevel: 6 },
  { featureKind: "label", hucLevel: 6 },
  { featureKind: "polygon", hucLevel: 8 },
  { featureKind: "line", hucLevel: 8 },
  { featureKind: "label", hucLevel: 8 },
  { featureKind: "polygon", hucLevel: 10 },
  { featureKind: "line", hucLevel: 10 },
  { featureKind: "label", hucLevel: 10 },
  { featureKind: "polygon", hucLevel: 12 },
  { featureKind: "line", hucLevel: 12 },
];

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
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

function stripAnsiDisplayCodes(value: string): string {
  let stripped = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\u001b") {
      stripped += character;
      continue;
    }

    const nextCharacter = value[index + 1];
    if (nextCharacter !== "[") {
      continue;
    }

    index += 2;
    while (index < value.length && value[index] !== "m") {
      index += 1;
    }
  }

  return stripped;
}

function decodeDuckDbJsonRows(value: string): readonly Readonly<Record<string, unknown>>[] {
  const normalized = stripAnsiDisplayCodes(value).trim();
  if (normalized.length === 0) {
    return [];
  }

  const payloadStart = normalized.search(JSON_PAYLOAD_START_RE);
  const payload = payloadStart >= 0 ? normalized.slice(payloadStart) : normalized;
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected DuckDB JSON output to be an array of records");
  }

  const rows: Readonly<Record<string, unknown>>[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Expected DuckDB JSON output rows to be records");
    }
    rows.push(entry);
  }

  return rows;
}

function decodeIntegerField(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected ${fieldName} to be an integer`);
  }

  return value;
}

function readPositiveInteger(value: string | undefined): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolveFloodExportBucketCount(env: NodeJS.ProcessEnv | undefined): number {
  const configured =
    readPositiveInteger(env?.ENVIRONMENTAL_FLOOD_TILE_BUCKET_COUNT) ??
    readPositiveInteger(process.env.ENVIRONMENTAL_FLOOD_TILE_BUCKET_COUNT);

  return configured ?? FLOOD_EXPORT_BUCKET_COUNT;
}

function resolveFloodExportMemoryLimit(env: NodeJS.ProcessEnv | undefined): string {
  const configured =
    env?.ENVIRONMENTAL_FLOOD_TILE_MEMORY_LIMIT?.trim() ??
    process.env.ENVIRONMENTAL_FLOOD_TILE_MEMORY_LIMIT?.trim();

  return typeof configured === "string" && configured.length > 0
    ? configured
    : FLOOD_EXPORT_MEMORY_LIMIT;
}

function resolveFloodRawBucketMemoryLimit(env: NodeJS.ProcessEnv | undefined): string {
  const configured =
    env?.ENVIRONMENTAL_FLOOD_TILE_RAW_BUCKET_MEMORY_LIMIT?.trim() ??
    process.env.ENVIRONMENTAL_FLOOD_TILE_RAW_BUCKET_MEMORY_LIMIT?.trim();

  return typeof configured === "string" && configured.length > 0
    ? configured
    : FLOOD_RAW_BUCKET_MEMORY_LIMIT;
}

function resolveFloodRawBucketMaxTempDirectorySize(env: NodeJS.ProcessEnv | undefined): string {
  const configured =
    env?.ENVIRONMENTAL_FLOOD_TILE_RAW_BUCKET_MAX_TEMP_DIRECTORY_SIZE?.trim() ??
    process.env.ENVIRONMENTAL_FLOOD_TILE_RAW_BUCKET_MAX_TEMP_DIRECTORY_SIZE?.trim();

  return typeof configured === "string" && configured.length > 0
    ? configured
    : FLOOD_RAW_BUCKET_MAX_TEMP_DIRECTORY_SIZE;
}

function resolveFloodExportMaxTempDirectorySize(env: NodeJS.ProcessEnv | undefined): string {
  const configured =
    env?.ENVIRONMENTAL_FLOOD_TILE_MAX_TEMP_DIRECTORY_SIZE?.trim() ??
    process.env.ENVIRONMENTAL_FLOOD_TILE_MAX_TEMP_DIRECTORY_SIZE?.trim();

  return typeof configured === "string" && configured.length > 0
    ? configured
    : FLOOD_EXPORT_MAX_TEMP_DIRECTORY_SIZE;
}

function resolveFloodSubdivideVertices(env: NodeJS.ProcessEnv | undefined): number {
  const configured =
    readPositiveInteger(env?.ENVIRONMENTAL_FLOOD_SUBDIVIDE_VERTICES) ??
    readPositiveInteger(process.env.ENVIRONMENTAL_FLOOD_SUBDIVIDE_VERTICES);

  if (configured === null) {
    return FLOOD_SUBDIVIDE_VERTICES;
  }

  return Math.max(configured, 8);
}

function resolveFloodPackageChunkSize(env: NodeJS.ProcessEnv | undefined): number {
  const configured =
    readPositiveInteger(env?.ENVIRONMENTAL_FLOOD_PACKAGE_CHUNK_SIZE) ??
    readPositiveInteger(process.env.ENVIRONMENTAL_FLOOD_PACKAGE_CHUNK_SIZE);

  if (configured === null) {
    return FLOOD_PACKAGE_CHUNK_SIZE;
  }

  return Math.max(configured, 1);
}

function resolveFloodPackageConcurrency(env: NodeJS.ProcessEnv | undefined): number {
  const configured =
    readPositiveInteger(env?.ENVIRONMENTAL_FLOOD_PACKAGE_CONCURRENCY) ??
    readPositiveInteger(process.env.ENVIRONMENTAL_FLOOD_PACKAGE_CONCURRENCY);

  if (configured === null) {
    return FLOOD_PACKAGE_CONCURRENCY;
  }

  return Math.max(configured, 1);
}

function normalizeCommandEnv(
  env: NodeJS.ProcessEnv | undefined
): Record<string, string> | undefined {
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

function buildFloodOgrSqliteScratchEnv(
  env: NodeJS.ProcessEnv | undefined
): Record<string, string> | undefined {
  const normalized = normalizeCommandEnv(env) ?? {};
  normalized.OGR_SQLITE_CACHE ??= FLOOD_PACKAGE_SQLITE_CACHE_MB;
  normalized.OGR_SQLITE_JOURNAL ??= FLOOD_PACKAGE_SQLITE_JOURNAL_MODE;
  normalized.OGR_SQLITE_PRAGMA ??= FLOOD_PACKAGE_SQLITE_PRAGMA;
  normalized.OGR_SQLITE_SYNCHRONOUS ??= "OFF";
  normalized.SQLITE_USE_OGR_VFS ??= "YES";
  return normalized;
}

function resolveOgr2OgrCommand(env: NodeJS.ProcessEnv = process.env): string {
  const explicit =
    env.OGR2OGR_BIN?.trim() ??
    env.OGR2OGR_EXECUTABLE?.trim() ??
    env.OGR2OGR_CLI?.trim() ??
    "ogr2ogr";

  return explicit.length > 0 ? explicit : "ogr2ogr";
}

function resolveOgrInfoCommand(env: NodeJS.ProcessEnv = process.env): string {
  const explicit =
    env.OGRINFO_BIN?.trim() ??
    env.OGRINFO_EXECUTABLE?.trim() ??
    env.OGRINFO_CLI?.trim() ??
    "ogrinfo";

  return explicit.length > 0 ? explicit : "ogrinfo";
}

function renderDuckDbExportSessionSql(args: {
  readonly memoryLimit: string;
  readonly maxTempDirectorySize: string;
  readonly runDir: string;
  readonly tempDirectoryName: string;
}): string {
  const tempDirectory = join(args.runDir, "duckdb", args.tempDirectoryName);
  rmSync(tempDirectory, {
    force: true,
    recursive: true,
  });
  mkdirSync(tempDirectory, {
    recursive: true,
  });

  return `SET memory_limit = ${toSqlStringLiteral(args.memoryLimit)};
SET max_temp_directory_size = ${toSqlStringLiteral(args.maxTempDirectorySize)};
SET temp_directory = ${toSqlStringLiteral(tempDirectory)};
SET threads = 1;
SET enable_geoparquet_conversion = true;
SET geometry_always_xy = true;
SET preserve_insertion_order = false;`;
}

function floodSourceGlob(args: {
  readonly lakeVersionRootPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
}): string {
  return join(args.lakeVersionRootPath, `flood_band=${args.overlayKind}`, "**", PARQUET_GLOB);
}

function hydroSourceGlob(args: {
  readonly featureKind: HydroPlanetilerOutput["featureKind"];
  readonly hucLevel: HydroPlanetilerOutput["hucLevel"];
  readonly lakeVersionRootPath: string;
}): string {
  return join(
    args.lakeVersionRootPath,
    `huc_level=${String(args.hucLevel)}`,
    `feature_kind=${args.featureKind}`,
    PARQUET_GLOB
  );
}

function prepareOutputFile(path: string): void {
  mkdirSync(dirname(path), {
    recursive: true,
  });
  rmSync(path, {
    force: true,
  });
}

function prepareOutputDirectory(path: string): void {
  rmSync(path, {
    force: true,
    recursive: true,
  });
  mkdirSync(path, {
    recursive: true,
  });
}

function ensureOutputDirectory(path: string): void {
  mkdirSync(path, {
    recursive: true,
  });
}

function assertOutputFile(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`planetiler input export missing output: ${path}`);
  }
  const stats = statSync(path);
  if (!stats.isFile()) {
    throw new Error(`planetiler input export is not a file: ${path}`);
  }
  if (stats.size <= 0) {
    throw new Error(`planetiler input export is empty: ${path}`);
  }
}

function cleanupDuckDbTempDirectory(args: {
  readonly runDir: string;
  readonly tempDirectoryName: string;
}): void {
  rmSync(join(args.runDir, "duckdb", args.tempDirectoryName), {
    force: true,
    recursive: true,
  });
}

function readDirectorySize(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }

  const entries = readdirSync(path, {
    withFileTypes: true,
  });

  return entries.reduce((total, entry) => {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      return total + readDirectorySize(entryPath);
    }
    if (entry.isFile()) {
      return total + statSync(entryPath).size;
    }

    return total;
  }, 0);
}

function buildFloodDissolvedGeoPackagePath(args: {
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runDir: string;
}): string {
  return join(
    args.runDir,
    "duckdb",
    "planetiler-inputs",
    `flood-overlay-${args.overlayKind}.dissolved.gpkg`
  );
}

function buildFloodRawBucketRootPath(args: {
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runDir: string;
}): string {
  return join(
    args.runDir,
    "duckdb",
    "planetiler-inputs",
    `flood-overlay-${args.overlayKind}-raw-buckets`
  );
}

function buildFloodRawBucketGlobPath(args: {
  readonly bucketIndex: number;
  readonly rootPath: string;
}): string {
  return join(args.rootPath, `bucket_id=${String(args.bucketIndex)}`, PARQUET_GLOB);
}

function buildFloodRawBucketGlobForSpec(args: {
  readonly bucketIndex: number;
  readonly outputPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
}): string {
  return join(
    dirname(args.outputPath),
    `flood-overlay-${args.overlayKind}-raw-buckets`,
    `bucket_id=${String(args.bucketIndex)}`,
    PARQUET_GLOB
  );
}

function buildFloodBucketChunkPath(args: {
  readonly bucketIndex: number;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runDir: string;
}): string {
  return join(
    args.runDir,
    "duckdb",
    "planetiler-inputs",
    `flood-overlay-${args.overlayKind}-${String(args.bucketIndex).padStart(2, "0")}.parquet`
  );
}

function buildFloodPackageChunkPath(args: {
  readonly chunkIndex: number;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runDir: string;
}): string {
  return join(
    args.runDir,
    "duckdb",
    "planetiler-inputs",
    `flood-overlay-${args.overlayKind}-package-chunks`,
    `flood-overlay-${args.overlayKind}-package-${String(args.chunkIndex).padStart(4, "0")}.gpkg`
  );
}

function buildFloodOverlayProfilePath(args: {
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runDir: string;
}): string {
  return join(args.runDir, "qa", "planetiler-inputs", `flood-overlay-${args.overlayKind}.json`);
}

function buildFloodOverlayPackageProgressPath(args: {
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runDir: string;
}): string {
  return join(
    args.runDir,
    "qa",
    "planetiler-inputs",
    `flood-overlay-${args.overlayKind}-package-progress.json`
  );
}

async function runOgr2Ogr(args: {
  readonly commandArgs: readonly string[];
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const env = normalizeCommandEnv(args.env);
  const result = await runBufferedCommand({
    args: args.commandArgs,
    command: resolveOgr2OgrCommand(args.env),
    cwd: args.cwd,
    ...(env === undefined ? {} : { env }),
  });

  if (result.exitCode !== 0) {
    throw new Error(`ogr2ogr failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`);
  }
}

async function runOgrInfoJson(args: {
  readonly commandArgs: readonly string[];
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<Readonly<Record<string, unknown>>> {
  const env = normalizeCommandEnv(args.env);
  const result = await runBufferedCommand({
    args: args.commandArgs,
    command: resolveOgrInfoCommand(args.env),
    cwd: args.cwd,
    ...(env === undefined ? {} : { env }),
  });

  if (result.exitCode !== 0) {
    throw new Error(`ogrinfo failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`);
  }

  const normalized = stripAnsiDisplayCodes(result.stdout).trim();
  if (normalized.length === 0) {
    throw new Error("ogrinfo produced no JSON output");
  }

  const parsed = JSON.parse(normalized);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected ogrinfo JSON output to be an object");
  }

  return parsed;
}

async function appendFloodChunkToGeoPackage(args: {
  readonly chunkPath: string;
  readonly context: Pick<EnvironmentalPlanetilerInputContext, "runDir">;
  readonly dissolvedPath: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const ogrEnv = buildFloodOgrSqliteScratchEnv(args.env);
  const commandArgs = existsSync(args.dissolvedPath)
    ? [
        "-f",
        "GPKG",
        "-update",
        "-append",
        args.dissolvedPath,
        args.chunkPath,
        "-nln",
        FLOOD_DISSOLVED_LAYER_NAME,
        "-gt",
        "200000",
      ]
    : [
        "-f",
        "GPKG",
        args.dissolvedPath,
        args.chunkPath,
        "-nln",
        FLOOD_DISSOLVED_LAYER_NAME,
        "-lco",
        "SPATIAL_INDEX=NO",
        "-gt",
        "200000",
      ];

  await runOgr2Ogr({
    commandArgs: [...commandArgs, "-a_srs", FLOOD_PLANETILER_SRID],
    cwd: args.context.runDir,
    ...(ogrEnv === undefined ? {} : { env: ogrEnv }),
  });
}

export function buildFloodSubdivisionChunkSql(args: {
  readonly maxFid: number;
  readonly minFid: number;
  readonly vertices: number;
}): string {
  return `WITH source_chunk AS (
  SELECT
    dfirm_id,
    FLD_ZONE,
    ZONE_SUBTY,
    SFHA_TF,
    SOURCE_CIT,
    is_flood_100,
    is_flood_500,
    flood_band,
    legend_key,
    data_version,
    geom
  FROM ${FLOOD_DISSOLVED_LAYER_NAME}
  WHERE geom IS NOT NULL
    AND NOT ST_IsEmpty(geom)
    AND fid BETWEEN ${String(args.minFid)} AND ${String(args.maxFid)}
  ORDER BY fid
)
SELECT
  dfirm_id,
  FLD_ZONE,
  ZONE_SUBTY,
  SFHA_TF,
  SOURCE_CIT,
  is_flood_100,
  is_flood_500,
  flood_band,
  legend_key,
  data_version,
  ST_CollectionExtract(
    ST_MakeValid(ST_Subdivide(geom, ${String(args.vertices)})),
    3
  ) AS geom
FROM source_chunk
WHERE geom IS NOT NULL
  AND NOT ST_IsEmpty(geom)`;
}

function buildFloodPackagingChunkPlanSql(args: {
  readonly chunkSize: number;
  readonly minFid: number;
}): string {
  return `SELECT
  CAST((fid - ${String(args.minFid)}) / ${String(args.chunkSize)} AS INTEGER) AS chunk_index,
  MIN(fid) AS min_fid,
  MAX(fid) AS max_fid,
  COUNT(*) AS row_count
FROM ${FLOOD_DISSOLVED_LAYER_NAME}
WHERE geom IS NOT NULL
  AND NOT ST_IsEmpty(geom)
GROUP BY 1
ORDER BY 1`;
}

function decodeFloodPackagingSourceStats(
  value: Readonly<Record<string, unknown>>
): FloodPackagingSourceStats {
  const layers = value.layers;
  if (!Array.isArray(layers)) {
    throw new Error("ogrinfo JSON output missing layers");
  }

  const firstLayer = layers[0];
  if (typeof firstLayer !== "object" || firstLayer === null || Array.isArray(firstLayer)) {
    throw new Error("ogrinfo JSON output missing first layer");
  }

  const features = (firstLayer as Record<string, unknown>).features;
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error("ogrinfo JSON output missing query features");
  }

  const firstFeature = features[0];
  if (typeof firstFeature !== "object" || firstFeature === null || Array.isArray(firstFeature)) {
    throw new Error("ogrinfo JSON output missing first feature");
  }

  const properties = (firstFeature as Record<string, unknown>).properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    throw new Error("ogrinfo JSON output missing query properties");
  }

  return {
    maxFid: decodeIntegerField((properties as Record<string, unknown>).max_fid, "max_fid"),
    minFid: decodeIntegerField((properties as Record<string, unknown>).min_fid, "min_fid"),
    rowCount: decodeIntegerField((properties as Record<string, unknown>).row_count, "row_count"),
  };
}

function decodeFloodPackagingChunkPlans(
  value: Readonly<Record<string, unknown>>
): readonly FloodPackagingChunkPlan[] {
  const layers = value.layers;
  if (!Array.isArray(layers)) {
    throw new Error("ogrinfo JSON output missing layers");
  }

  const firstLayer = layers[0];
  if (typeof firstLayer !== "object" || firstLayer === null || Array.isArray(firstLayer)) {
    throw new Error("ogrinfo JSON output missing first layer");
  }

  const features = (firstLayer as Record<string, unknown>).features;
  if (!Array.isArray(features)) {
    throw new Error("ogrinfo JSON output missing query features");
  }

  const chunkPlans: FloodPackagingChunkPlan[] = [];
  for (const feature of features) {
    if (typeof feature !== "object" || feature === null || Array.isArray(feature)) {
      throw new Error("ogrinfo JSON output missing query feature");
    }

    const properties = (feature as Record<string, unknown>).properties;
    if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
      throw new Error("ogrinfo JSON output missing query properties");
    }

    const propertyRecord = properties as Record<string, unknown>;
    chunkPlans.push({
      chunkIndex: decodeIntegerField(propertyRecord.chunk_index, "chunk_index"),
      maxFid: decodeIntegerField(propertyRecord.max_fid, "max_fid"),
      minFid: decodeIntegerField(propertyRecord.min_fid, "min_fid"),
      rowCount: decodeIntegerField(propertyRecord.row_count, "row_count"),
    });
  }

  return chunkPlans;
}

async function readFloodPackagingSourceStats(args: {
  readonly context: Pick<EnvironmentalPlanetilerInputContext, "runDir">;
  readonly dissolvedPath: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<FloodPackagingSourceStats> {
  const result = await runOgrInfoJson({
    commandArgs: [
      "-json",
      args.dissolvedPath,
      "-dialect",
      "SQLITE",
      "-sql",
      `SELECT COUNT(*) AS row_count, MIN(fid) AS min_fid, MAX(fid) AS max_fid FROM ${FLOOD_DISSOLVED_LAYER_NAME}`,
      "-features",
    ],
    cwd: args.context.runDir,
    ...(args.env === undefined ? {} : { env: args.env }),
  });

  return decodeFloodPackagingSourceStats(result);
}

async function readFloodPackagingChunkPlans(args: {
  readonly chunkSize: number;
  readonly context: Pick<EnvironmentalPlanetilerInputContext, "runDir">;
  readonly dissolvedPath: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly minFid: number;
}): Promise<readonly FloodPackagingChunkPlan[]> {
  const result = await runOgrInfoJson({
    commandArgs: [
      "-json",
      args.dissolvedPath,
      "-dialect",
      "SQLITE",
      "-sql",
      buildFloodPackagingChunkPlanSql({
        chunkSize: args.chunkSize,
        minFid: args.minFid,
      }),
      "-features",
    ],
    cwd: args.context.runDir,
    ...(args.env === undefined ? {} : { env: args.env }),
  });

  return decodeFloodPackagingChunkPlans(result);
}

function writeFloodPackagingProgress(args: {
  readonly chunkSize: number;
  readonly completedChunks: number;
  readonly completedSourceRows: number;
  readonly outputPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly phase: FloodPlanetilerPackagingProgress["phase"];
  readonly progressPath: string;
  readonly totalChunks: number;
  readonly totalSourceRows: number;
}): void {
  const progress: FloodPlanetilerPackagingProgress = {
    chunkSize: args.chunkSize,
    completedChunks: args.completedChunks,
    completedSourceRows: args.completedSourceRows,
    outputPath: args.outputPath,
    overlayKind: args.overlayKind,
    phase: args.phase,
    percentComplete:
      args.totalSourceRows === 0
        ? 100
        : Number(((args.completedSourceRows / args.totalSourceRows) * 100).toFixed(1)),
    progressVersion: FLOOD_PACKAGE_PROGRESS_VERSION,
    totalChunks: args.totalChunks,
    totalSourceRows: args.totalSourceRows,
    updatedAt: new Date().toISOString(),
  };

  ensureOutputDirectory(dirname(args.progressPath));
  writeFileSync(args.progressPath, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

async function runWithConcurrency<T>(args: {
  readonly concurrency: number;
  readonly items: readonly T[];
  readonly worker: (item: T) => Promise<void>;
}): Promise<void> {
  const workerCount = Math.max(Math.min(args.concurrency, args.items.length), 1);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const item = args.items[nextIndex];
      nextIndex += 1;
      if (item === undefined) {
        return;
      }

      await args.worker(item);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

async function createFloodGeoPackageSpatialIndex(args: {
  readonly context: Pick<EnvironmentalPlanetilerInputContext, "runDir">;
  readonly env?: NodeJS.ProcessEnv;
  readonly outputPath: string;
}): Promise<void> {
  const env = buildFloodOgrSqliteScratchEnv(args.env);
  const result = await runOgrInfoJson({
    commandArgs: [
      "-json",
      args.outputPath,
      "-dialect",
      "SQLITE",
      "-sql",
      `SELECT CreateSpatialIndex(${toSqlStringLiteral(FLOOD_PLANETILER_LAYER_NAME)}, 'geom') AS created`,
      "-features",
    ],
    cwd: args.context.runDir,
    ...(env === undefined ? {} : { env }),
  });

  const layers = result.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new Error("ogrinfo spatial index creation produced no layers");
  }
}

async function finalizeFloodGeoPackage(args: {
  readonly context: Pick<EnvironmentalPlanetilerInputContext, "runDir">;
  readonly dissolvedPath: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly outputPath: string;
  readonly packageChunkSize: number;
  readonly subdivideVertices: number;
}): Promise<void> {
  prepareOutputFile(args.outputPath);
  const sourceStats = await readFloodPackagingSourceStats({
    context: args.context,
    dissolvedPath: args.dissolvedPath,
    ...(args.env === undefined ? {} : { env: args.env }),
  });
  const chunkPlans = await readFloodPackagingChunkPlans({
    chunkSize: args.packageChunkSize,
    context: args.context,
    dissolvedPath: args.dissolvedPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    minFid: sourceStats.minFid,
  });
  const totalSourceRows = chunkPlans.reduce((sum, chunkPlan) => sum + chunkPlan.rowCount, 0);
  const totalChunks = chunkPlans.length;
  const progressPath = buildFloodOverlayPackageProgressPath({
    overlayKind: args.overlayKind,
    runDir: args.context.runDir,
  });
  const packageChunkRoot = join(
    args.context.runDir,
    "duckdb",
    "planetiler-inputs",
    `flood-overlay-${args.overlayKind}-package-chunks`
  );

  prepareOutputDirectory(packageChunkRoot);
  const ogrEnv = buildFloodOgrSqliteScratchEnv(args.env);

  writeFloodPackagingProgress({
    chunkSize: args.packageChunkSize,
    completedChunks: 0,
    completedSourceRows: 0,
    outputPath: args.outputPath,
    overlayKind: args.overlayKind,
    phase: "subdivide",
    progressPath,
    totalChunks,
    totalSourceRows,
  });

  let completedSubdivideChunks = 0;
  let completedSubdivideRows = 0;
  const packageConcurrency = resolveFloodPackageConcurrency(args.env);

  try {
    await runWithConcurrency({
      concurrency: packageConcurrency,
      items: chunkPlans,
      worker: async (chunkPlan) => {
        const chunkPath = buildFloodPackageChunkPath({
          chunkIndex: chunkPlan.chunkIndex,
          overlayKind: args.overlayKind,
          runDir: args.context.runDir,
        });

        prepareOutputFile(chunkPath);
        await runOgr2Ogr({
          commandArgs: [
            "-f",
            "GPKG",
            chunkPath,
            args.dissolvedPath,
            "-dialect",
            "SQLITE",
            "-sql",
            buildFloodSubdivisionChunkSql({
              maxFid: chunkPlan.maxFid,
              minFid: chunkPlan.minFid,
              vertices: args.subdivideVertices,
            }),
            "-nln",
            FLOOD_PLANETILER_LAYER_NAME,
            "-overwrite",
            "-lco",
            "SPATIAL_INDEX=NO",
            "-a_srs",
            FLOOD_PLANETILER_SRID,
            "-explodecollections",
            "-gt",
            "200000",
          ],
          cwd: args.context.runDir,
          ...(ogrEnv === undefined ? {} : { env: ogrEnv }),
        });

        assertOutputFile(chunkPath);
        completedSubdivideChunks += 1;
        completedSubdivideRows += chunkPlan.rowCount;

        console.error(
          `[planetiler-inputs] flood overlay=${args.overlayKind} package-subdivide-progress=${String(completedSubdivideChunks)}/${String(totalChunks)} (${((completedSubdivideRows / Math.max(totalSourceRows, 1)) * 100).toFixed(1)}%) rows=${String(completedSubdivideRows)}/${String(totalSourceRows)}`
        );
        writeFloodPackagingProgress({
          chunkSize: args.packageChunkSize,
          completedChunks: completedSubdivideChunks,
          completedSourceRows: completedSubdivideRows,
          outputPath: args.outputPath,
          overlayKind: args.overlayKind,
          phase: "subdivide",
          progressPath,
          totalChunks,
          totalSourceRows,
        });
      },
    });

    let completedMergeChunks = 0;
    let completedMergeRows = 0;
    for (const chunkPlan of chunkPlans) {
      const chunkPath = buildFloodPackageChunkPath({
        chunkIndex: chunkPlan.chunkIndex,
        overlayKind: args.overlayKind,
        runDir: args.context.runDir,
      });
      const commandArgs =
        completedMergeChunks === 0
          ? [
              "-f",
              "GPKG",
              args.outputPath,
              chunkPath,
              FLOOD_PLANETILER_LAYER_NAME,
              "-nln",
              FLOOD_PLANETILER_LAYER_NAME,
              "-overwrite",
              "-lco",
              "SPATIAL_INDEX=NO",
              "-gt",
              "200000",
            ]
          : [
              "-f",
              "GPKG",
              "-update",
              "-append",
              args.outputPath,
              chunkPath,
              FLOOD_PLANETILER_LAYER_NAME,
              "-nln",
              FLOOD_PLANETILER_LAYER_NAME,
              "-gt",
              "200000",
            ];

      await runOgr2Ogr({
        commandArgs,
        cwd: args.context.runDir,
        ...(ogrEnv === undefined ? {} : { env: ogrEnv }),
      });
      rmSync(chunkPath, {
        force: true,
      });

      completedMergeChunks += 1;
      completedMergeRows += chunkPlan.rowCount;
      console.error(
        `[planetiler-inputs] flood overlay=${args.overlayKind} package-merge-progress=${String(completedMergeChunks)}/${String(totalChunks)} (${((completedMergeRows / Math.max(totalSourceRows, 1)) * 100).toFixed(1)}%) rows=${String(completedMergeRows)}/${String(totalSourceRows)}`
      );
      writeFloodPackagingProgress({
        chunkSize: args.packageChunkSize,
        completedChunks: completedMergeChunks,
        completedSourceRows: completedMergeRows,
        outputPath: args.outputPath,
        overlayKind: args.overlayKind,
        phase: "merge",
        progressPath,
        totalChunks,
        totalSourceRows,
      });
    }

    writeFloodPackagingProgress({
      chunkSize: args.packageChunkSize,
      completedChunks: totalChunks,
      completedSourceRows: totalSourceRows,
      outputPath: args.outputPath,
      overlayKind: args.overlayKind,
      phase: "index",
      progressPath,
      totalChunks,
      totalSourceRows,
    });
    await createFloodGeoPackageSpatialIndex({
      context: args.context,
      ...(args.env === undefined ? {} : { env: args.env }),
      outputPath: args.outputPath,
    });
    writeFloodPackagingProgress({
      chunkSize: args.packageChunkSize,
      completedChunks: totalChunks,
      completedSourceRows: totalSourceRows,
      outputPath: args.outputPath,
      overlayKind: args.overlayKind,
      phase: "completed",
      progressPath,
      totalChunks,
      totalSourceRows,
    });
  } finally {
    rmSync(packageChunkRoot, {
      force: true,
      recursive: true,
    });
  }
}

function buildFloodBucketShardSql(args: {
  readonly bucketCount: number;
  readonly lakeVersionRootPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly outputRootPath: string;
}): string {
  const sourceGlob = floodSourceGlob({
    lakeVersionRootPath: args.lakeVersionRootPath,
    overlayKind: args.overlayKind,
  });

  return `COPY (
WITH transformed AS (
  SELECT
    COALESCE(dfirm_id, 'unknown') AS dfirm_id,
    data_version,
    hash(COALESCE(dfirm_id, 'unknown')) % ${String(args.bucketCount)} AS bucket_id,
    ST_CollectionExtract(
      ST_MakeValid(ST_Transform(geom, 'EPSG:4326', '${FLOOD_PLANETILER_SRID}', true)),
      3
    ) AS geom
  FROM read_parquet(${toSqlStringLiteral(sourceGlob)}, hive_partitioning = false)
  WHERE geom IS NOT NULL
    AND NOT ST_IsEmpty(geom)
)
SELECT
  dfirm_id,
  data_version,
  bucket_id,
  geom
FROM transformed
WHERE geom IS NOT NULL
  AND NOT ST_IsEmpty(geom)
) TO ${toSqlStringLiteral(args.outputRootPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD,
  FILENAME_PATTERN '${FLOOD_BUCKET_FILENAME_PATTERN}',
  PARTITION_BY (bucket_id)
);`;
}

function buildFloodDissolveBucketSql(args: {
  readonly output: FloodPlanetilerOverlayOutput;
  readonly outputPath: string;
  readonly sourceGlob: string;
}): string {
  const floodZone = args.output.overlayKind === "100" ? "SFHA" : "0.2 PCT";
  const sfhaFlag = args.output.overlayKind === "100" ? "T" : "F";
  const isFlood100 = args.output.overlayKind === "100" ? "1" : "0";
  const isFlood500 = args.output.overlayKind === "500" ? "1" : "0";

  return `COPY (
SELECT
  dfirm_id,
  ${toSqlStringLiteral(floodZone)} AS FLD_ZONE,
  NULL AS ZONE_SUBTY,
  ${toSqlStringLiteral(sfhaFlag)} AS SFHA_TF,
  NULL AS SOURCE_CIT,
  ${isFlood100} AS is_flood_100,
  ${isFlood500} AS is_flood_500,
  ${toSqlStringLiteral(args.output.overlayKind)} AS flood_band,
  ${toSqlStringLiteral(`flood-${args.output.overlayKind}`)} AS legend_key,
  data_version,
  ST_CollectionExtract(ST_MakeValid(${FLOOD_DISSOLVE_AGGREGATE}(geom)), 3) AS geom
FROM read_parquet(${toSqlStringLiteral(args.sourceGlob)}, hive_partitioning = false)
WHERE geom IS NOT NULL
  AND NOT ST_IsEmpty(geom)
GROUP BY
  1,
  10
) TO ${toSqlStringLiteral(args.outputPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`;
}

function buildFloodBucketMetricsSql(args: {
  readonly bucketParquetPath: string;
  readonly bucketSourceGlob: string;
}): string {
  return `SELECT
  (SELECT COUNT(*)::BIGINT FROM read_parquet(${toSqlStringLiteral(args.bucketSourceGlob)}, hive_partitioning = false)) AS input_row_count,
  (SELECT COUNT(DISTINCT dfirm_id)::BIGINT FROM read_parquet(${toSqlStringLiteral(args.bucketSourceGlob)}, hive_partitioning = false)) AS input_dfirm_id_count,
  (SELECT COUNT(DISTINCT dfirm_id || ${toSqlStringLiteral(FLOOD_BUCKET_SEPARATOR)} || data_version)::BIGINT FROM read_parquet(${toSqlStringLiteral(args.bucketSourceGlob)}, hive_partitioning = false)) AS input_group_count,
  (SELECT COUNT(*)::BIGINT FROM read_parquet(${toSqlStringLiteral(args.bucketParquetPath)}, hive_partitioning = false)) AS output_row_count;`;
}

function buildHydroPlanetilerCopySql(args: {
  readonly lakeVersionRootPath: string;
  readonly output: HydroPlanetilerOutput;
}): string {
  const sourceGlob = hydroSourceGlob({
    featureKind: args.output.featureKind,
    hucLevel: args.output.hucLevel,
    lakeVersionRootPath: args.lakeVersionRootPath,
  });

  if (args.output.featureKind === "polygon") {
    return `COPY (
SELECT json_object(
  'type', 'Feature',
  'properties', json_object(
    'huc', huc,
    'name', name,
    'areasqkm', areasqkm,
    'states', states,
    'data_version', data_version
  ),
  'geometry', CAST(ST_AsGeoJSON(geom) AS JSON)
)::VARCHAR AS feature
FROM read_parquet(${toSqlStringLiteral(sourceGlob)}, hive_partitioning = false)
WHERE geom IS NOT NULL
) TO ${toSqlStringLiteral(args.output.outputPath)} (
  FORMAT CSV,
  HEADER FALSE,
  QUOTE '',
  ESCAPE ''
);`;
  }

  if (args.output.featureKind === "line") {
    return `COPY (
SELECT json_object(
  'type', 'Feature',
  'properties', json_object(
    'huc_level', ${toSqlStringLiteral(`huc${String(args.output.hucLevel)}`)},
    'data_version', data_version
  ),
  'geometry', CAST(ST_AsGeoJSON(geom) AS JSON)
)::VARCHAR AS feature
FROM read_parquet(${toSqlStringLiteral(sourceGlob)}, hive_partitioning = false)
WHERE geom IS NOT NULL
) TO ${toSqlStringLiteral(args.output.outputPath)} (
  FORMAT CSV,
  HEADER FALSE,
  QUOTE '',
  ESCAPE ''
);`;
  }

  return `COPY (
SELECT json_object(
  'type', 'Feature',
  'properties', json_object(
    'name', name,
    'huc', huc,
    'areasqkm', areasqkm,
    'label_rank', label_rank,
    'states', states,
    'data_version', data_version
  ),
  'geometry', CAST(ST_AsGeoJSON(geom) AS JSON)
)::VARCHAR AS feature
FROM read_parquet(${toSqlStringLiteral(sourceGlob)}, hive_partitioning = false)
WHERE geom IS NOT NULL
) TO ${toSqlStringLiteral(args.output.outputPath)} (
  FORMAT CSV,
  HEADER FALSE,
  QUOTE '',
  ESCAPE ''
);`;
}

export function buildFloodPlanetilerInputSpec(args: {
  readonly lakeVersionRootPath: string;
  readonly outputRoot: string;
  readonly overlayKinds: readonly FloodPlanetilerOverlayKind[];
}): FloodPlanetilerInputSpec {
  return {
    lakeVersionRootPath: args.lakeVersionRootPath,
    outputs: args.overlayKinds.map((overlayKind) => ({
      outputPath: join(args.outputRoot, `flood-overlay-${overlayKind}.gpkg`),
      overlayKind,
    })),
  };
}

export function buildFloodPlanetilerInputSql(spec: FloodPlanetilerInputSpec): string {
  return spec.outputs
    .map((output) =>
      [
        buildFloodBucketShardSql({
          bucketCount: FLOOD_EXPORT_BUCKET_COUNT,
          lakeVersionRootPath: spec.lakeVersionRootPath,
          outputRootPath: join(
            dirname(output.outputPath),
            `flood-overlay-${output.overlayKind}-raw-buckets`
          ),
          overlayKind: output.overlayKind,
        }),
        buildFloodDissolveBucketSql({
          output,
          outputPath: join(
            dirname(output.outputPath),
            `flood-overlay-${output.overlayKind}-bucket-00.parquet`
          ),
          sourceGlob: buildFloodRawBucketGlobForSpec({
            bucketIndex: 0,
            outputPath: output.outputPath,
            overlayKind: output.overlayKind,
          }),
        }),
      ].join("\n\n")
    )
    .join("\n\n");
}

export function buildHydroPlanetilerInputSpec(args: {
  readonly lakeVersionRootPath: string;
  readonly outputRoot: string;
}): HydroPlanetilerInputSpec {
  return {
    lakeVersionRootPath: args.lakeVersionRootPath,
    outputs: HYDRO_OUTPUT_MATRIX.map((output) => ({
      featureKind: output.featureKind,
      hucLevel: output.hucLevel,
      outputPath: join(
        args.outputRoot,
        `huc${String(output.hucLevel)}-${output.featureKind}.geojsonl`
      ),
    })),
  };
}

export function buildHydroPlanetilerInputSql(spec: HydroPlanetilerInputSpec): string {
  return spec.outputs
    .map((output) =>
      buildHydroPlanetilerCopySql({
        lakeVersionRootPath: spec.lakeVersionRootPath,
        output,
      })
    )
    .join("\n\n");
}

async function runPlanetilerInputExport(args: {
  readonly context: Pick<
    EnvironmentalPlanetilerInputContext,
    "runDir" | "runDuckDbBootstrapPath" | "runDuckDbPath"
  >;
  readonly databasePath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly maxTempDirectorySize?: string;
  readonly memoryLimit?: string;
  readonly sql: string;
  readonly tempDirectoryName?: string;
}): Promise<void> {
  const sessionSql = renderDuckDbExportSessionSql({
    memoryLimit: args.memoryLimit ?? "8GB",
    maxTempDirectorySize: args.maxTempDirectorySize ?? FLOOD_EXPORT_MAX_TEMP_DIRECTORY_SIZE,
    runDir: args.context.runDir,
    tempDirectoryName: args.tempDirectoryName ?? "tmp",
  });
  const result = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.databasePath ?? args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    sql: `${sessionSql}\n${args.sql}`,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `planetiler input export failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }
}

async function readDuckDbJsonRows(args: {
  readonly context: Pick<
    EnvironmentalPlanetilerInputContext,
    "runDir" | "runDuckDbBootstrapPath" | "runDuckDbPath"
  >;
  readonly env?: NodeJS.ProcessEnv;
  readonly sql: string;
}): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const result = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    outputMode: "json",
    readOnly: true,
    stdoutCaptureMaxBytes: DUCKDB_JSON_CAPTURE_MAX_BYTES,
    sql: args.sql,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `planetiler input metrics read failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  return decodeDuckDbJsonRows(result.stdout);
}

async function readFloodBucketMetrics(args: {
  readonly bucketParquetPath: string;
  readonly bucketSourceGlob: string;
  readonly context: Pick<
    EnvironmentalPlanetilerInputContext,
    "runDir" | "runDuckDbBootstrapPath" | "runDuckDbPath"
  >;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<FloodBucketMetrics> {
  const rows = await readDuckDbJsonRows({
    context: args.context,
    ...(args.env === undefined ? {} : { env: args.env }),
    sql: buildFloodBucketMetricsSql({
      bucketParquetPath: args.bucketParquetPath,
      bucketSourceGlob: args.bucketSourceGlob,
    }),
  });

  const row = rows[0];
  if (row === undefined) {
    throw new Error("Missing flood bucket metrics row");
  }

  return {
    inputDfirmIdCount: decodeIntegerField(row.input_dfirm_id_count, "input_dfirm_id_count"),
    inputGroupCount: decodeIntegerField(row.input_group_count, "input_group_count"),
    inputRowCount: decodeIntegerField(row.input_row_count, "input_row_count"),
    outputRowCount: decodeIntegerField(row.output_row_count, "output_row_count"),
  };
}

function writeFloodOverlayProfile(args: {
  readonly bucketProfiles: readonly FloodBucketProfile[];
  readonly outputPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly rawShardBytes: number;
  readonly rawShardDurationMs: number;
  readonly rawShardRootPath: string;
}): void {
  ensureOutputDirectory(dirname(args.outputPath));
  writeFileSync(
    args.outputPath,
    `${JSON.stringify(
      {
        bucketCount: args.bucketProfiles.length,
        bucketProfiles: args.bucketProfiles,
        overlayKind: args.overlayKind,
        profileVersion: FLOOD_BUCKET_PROFILE_VERSION,
        rawShardBytes: args.rawShardBytes,
        rawShardDurationMs: args.rawShardDurationMs,
        rawShardRootPath: args.rawShardRootPath,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writeFloodPlanetilerOverlayInput(args: {
  readonly bucketCount: number;
  readonly context: WriteFloodPlanetilerInputsArgs["context"];
  readonly env?: NodeJS.ProcessEnv;
  readonly lakeVersionRootPath: string;
  readonly maxTempDirectorySize: string;
  readonly memoryLimit: string;
  readonly output: FloodPlanetilerOverlayOutput;
  readonly rawBucketMaxTempDirectorySize: string;
  readonly rawBucketMemoryLimit: string;
  readonly subdivideVertices: number;
}): Promise<void> {
  const dissolvedPath = buildFloodDissolvedGeoPackagePath({
    overlayKind: args.output.overlayKind,
    runDir: args.context.runDir,
  });
  const overlayProfilePath = buildFloodOverlayProfilePath({
    overlayKind: args.output.overlayKind,
    runDir: args.context.runDir,
  });
  const rawBucketRootPath = buildFloodRawBucketRootPath({
    overlayKind: args.output.overlayKind,
    runDir: args.context.runDir,
  });
  prepareOutputFile(dissolvedPath);
  prepareOutputDirectory(join(args.context.runDir, "duckdb", "planetiler-inputs"));
  rmSync(rawBucketRootPath, {
    force: true,
    recursive: true,
  });

  try {
    const bucketProfiles: FloodBucketProfile[] = [];
    const shardTempDirectoryName = `planetiler-inputs-${args.output.overlayKind}-raw-buckets`;
    const shardStartedAt = Date.now();
    let rawShardBytes = 0;

    console.error(
      `[planetiler-inputs] flood overlay=${args.output.overlayKind} phase=raw-bucket-stage`
    );
    try {
      await runPlanetilerInputExport({
        context: args.context,
        databasePath: ":memory:",
        ...(args.env === undefined ? {} : { env: args.env }),
        maxTempDirectorySize: args.rawBucketMaxTempDirectorySize,
        memoryLimit: args.rawBucketMemoryLimit,
        sql: buildFloodBucketShardSql({
          bucketCount: args.bucketCount,
          lakeVersionRootPath: args.lakeVersionRootPath,
          outputRootPath: rawBucketRootPath,
          overlayKind: args.output.overlayKind,
        }),
        tempDirectoryName: shardTempDirectoryName,
      });
      rawShardBytes = readDirectorySize(rawBucketRootPath);
    } finally {
      cleanupDuckDbTempDirectory({
        runDir: args.context.runDir,
        tempDirectoryName: shardTempDirectoryName,
      });
    }

    console.error(
      `[planetiler-inputs] flood overlay=${args.output.overlayKind} phase=bucket-dissolve`
    );
    for (let bucketIndex = 0; bucketIndex < args.bucketCount; bucketIndex += 1) {
      const bucketSourceGlob = buildFloodRawBucketGlobPath({
        bucketIndex,
        rootPath: rawBucketRootPath,
      });
      const bucketSourceDirectory = dirname(bucketSourceGlob);
      if (!existsSync(bucketSourceDirectory)) {
        continue;
      }

      const bucketPath = buildFloodBucketChunkPath({
        bucketIndex,
        overlayKind: args.output.overlayKind,
        runDir: args.context.runDir,
      });
      const bucketTempDirectoryName = `planetiler-inputs-${args.output.overlayKind}-bucket-${String(bucketIndex).padStart(2, "0")}`;
      const bucketStartedAt = Date.now();
      prepareOutputFile(bucketPath);

      try {
        await runPlanetilerInputExport({
          context: args.context,
          databasePath: ":memory:",
          ...(args.env === undefined ? {} : { env: args.env }),
          maxTempDirectorySize: args.maxTempDirectorySize,
          memoryLimit: args.memoryLimit,
          sql: buildFloodDissolveBucketSql({
            output: args.output,
            outputPath: bucketPath,
            sourceGlob: bucketSourceGlob,
          }),
          tempDirectoryName: bucketTempDirectoryName,
        });

        if (!existsSync(bucketPath)) {
          continue;
        }

        const bucketStats = statSync(bucketPath);
        if (bucketStats.size <= 0) {
          continue;
        }

        const bucketMetrics = await readFloodBucketMetrics({
          bucketParquetPath: bucketPath,
          bucketSourceGlob,
          context: args.context,
          ...(args.env === undefined ? {} : { env: args.env }),
        });

        await appendFloodChunkToGeoPackage({
          chunkPath: bucketPath,
          context: args.context,
          dissolvedPath,
          ...(args.env === undefined ? {} : { env: args.env }),
        });

        bucketProfiles.push({
          bucketIndex,
          durationMs: Date.now() - bucketStartedAt,
          inputDfirmIdCount: bucketMetrics.inputDfirmIdCount,
          inputGroupCount: bucketMetrics.inputGroupCount,
          inputRowCount: bucketMetrics.inputRowCount,
          outputBytes: bucketStats.size,
          outputRowCount: bucketMetrics.outputRowCount,
          overlayKind: args.output.overlayKind,
          tempDirectoryBytes: readDirectorySize(
            join(args.context.runDir, "duckdb", bucketTempDirectoryName)
          ),
        });
      } finally {
        cleanupDuckDbTempDirectory({
          runDir: args.context.runDir,
          tempDirectoryName: bucketTempDirectoryName,
        });
        rmSync(bucketPath, {
          force: true,
        });
      }
    }

    writeFloodOverlayProfile({
      bucketProfiles,
      outputPath: overlayProfilePath,
      overlayKind: args.output.overlayKind,
      rawShardBytes,
      rawShardDurationMs: Date.now() - shardStartedAt,
      rawShardRootPath: rawBucketRootPath,
    });

    if (!existsSync(dissolvedPath)) {
      throw new Error(
        `planetiler input export produced no dissolved features for flood overlay ${args.output.overlayKind}`
      );
    }

    console.error(`[planetiler-inputs] flood overlay=${args.output.overlayKind} phase=package`);
    await finalizeFloodGeoPackage({
      context: args.context,
      dissolvedPath,
      ...(args.env === undefined ? {} : { env: args.env }),
      overlayKind: args.output.overlayKind,
      outputPath: args.output.outputPath,
      packageChunkSize: resolveFloodPackageChunkSize(args.env),
      subdivideVertices: args.subdivideVertices,
    });
  } catch (error) {
    rmSync(args.output.outputPath, {
      force: true,
    });
    throw error;
  } finally {
    rmSync(dissolvedPath, {
      force: true,
    });
    rmSync(rawBucketRootPath, {
      force: true,
      recursive: true,
    });
    rmSync(join(args.context.runDir, "duckdb", "planetiler-inputs"), {
      force: true,
      recursive: true,
    });
  }
}

export async function writeFloodPlanetilerInputs(
  args: WriteFloodPlanetilerInputsArgs
): Promise<FloodPlanetilerInputSpec> {
  const bucketCount = resolveFloodExportBucketCount(args.env);
  const memoryLimit = resolveFloodExportMemoryLimit(args.env);
  const rawBucketMemoryLimit = resolveFloodRawBucketMemoryLimit(args.env);
  const rawBucketMaxTempDirectorySize = resolveFloodRawBucketMaxTempDirectorySize(args.env);
  const maxTempDirectorySize = resolveFloodExportMaxTempDirectorySize(args.env);
  const subdivideVertices = resolveFloodSubdivideVertices(args.env);
  const spec = buildFloodPlanetilerInputSpec({
    lakeVersionRootPath: args.lakeVersionRootPath,
    outputRoot: args.context.outputRoot,
    overlayKinds: args.overlayKinds,
  });

  for (const output of spec.outputs) {
    prepareOutputFile(output.outputPath);
  }

  for (const output of spec.outputs) {
    await writeFloodPlanetilerOverlayInput({
      bucketCount,
      context: args.context,
      ...(args.env === undefined ? {} : { env: args.env }),
      lakeVersionRootPath: spec.lakeVersionRootPath,
      maxTempDirectorySize,
      memoryLimit,
      output,
      rawBucketMaxTempDirectorySize,
      rawBucketMemoryLimit,
      subdivideVertices,
    });
  }

  for (const output of spec.outputs) {
    assertOutputFile(output.outputPath);
  }

  return spec;
}

export async function writeHydroPlanetilerInputs(
  args: WriteHydroPlanetilerInputsArgs
): Promise<HydroPlanetilerInputSpec> {
  const spec = buildHydroPlanetilerInputSpec({
    lakeVersionRootPath: args.lakeVersionRootPath,
    outputRoot: args.context.outputRoot,
  });

  for (const output of spec.outputs) {
    prepareOutputFile(output.outputPath);
  }

  await runPlanetilerInputExport({
    context: args.context,
    ...(args.env === undefined ? {} : { env: args.env }),
    sql: buildHydroPlanetilerInputSql(spec),
  });

  for (const output of spec.outputs) {
    assertOutputFile(output.outputPath);
  }

  return spec;
}
