import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { ensureDirectory } from "./atomic-file-store";
import { runBufferedCommand } from "./command-runner";
import { runDuckDbCli } from "./duckdb-runner";
import type {
  FloodCanonicalGeoParquetArtifactSpec,
  FloodCanonicalGeoParquetBand,
  FloodCanonicalGeoParquetBandOutput,
  FloodCanonicalGeoParquetResult,
  FloodCanonicalGeoParquetValidationCounts,
  FloodCanonicalGeoParquetValidationRow,
  FloodCanonicalGeoParquetWriteArgs,
} from "./environmental-flood-geoparquet.types";

const SQL_STRING_ESCAPE_RE = /'/g;
const JSON_PAYLOAD_START_RE = /[[{]/;
const FLOOD_CANONICAL_LAYER = "flood_hazard";
const FLOOD_BANDS: readonly FloodCanonicalGeoParquetBand[] = ["full", "100", "500"];
const PARQUET_FILE_NAME = "part-0.parquet";
const PSQL_COUNT_ROW_RE = /^(\d+)\t(\d+)\t(\d+)$/;

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function normalizeManifestRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
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
  if (!(Array.isArray(parsed) && parsed.every((entry) => isJsonRecord(entry)))) {
    throw new Error("Expected DuckDB JSON output to be an array of records");
  }

  return parsed;
}

function readNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function decodeValidationRows(
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly FloodCanonicalGeoParquetValidationRow[] {
  return rows.flatMap((row) => {
    const floodBand = row.flood_band;
    const geometryType = row.geometry_type;
    const rowCount = readNullableNumber(row.row_count);
    const nullGeomCount = readNullableNumber(row.null_geom_count);

    if (
      (floodBand !== "full" && floodBand !== "100" && floodBand !== "500") ||
      typeof geometryType !== "string" ||
      rowCount === null ||
      nullGeomCount === null
    ) {
      return [];
    }

    return [
      {
        flood_band: floodBand,
        geometry_type: geometryType,
        max_geom_xmax: readNullableNumber(row.max_geom_xmax),
        max_xmax: readNullableNumber(row.max_xmax),
        min_geom_xmin: readNullableNumber(row.min_geom_xmin),
        min_xmin: readNullableNumber(row.min_xmin),
        null_geom_count: nullGeomCount,
        row_count: rowCount,
      },
    ];
  });
}

function buildBandOutputPath(args: {
  readonly band: FloodCanonicalGeoParquetBand;
  readonly rootPath: string;
}): string {
  return join(
    args.rootPath,
    `flood_band=${args.band}`,
    "source_state_unit=unknown",
    PARQUET_FILE_NAME
  );
}

export function buildFloodCanonicalGeoParquetArtifact(
  args: Pick<FloodCanonicalGeoParquetWriteArgs, "context" | "dataVersion">
): FloodCanonicalGeoParquetArtifactSpec {
  const stageVersionRootPath = join(
    args.context.runDir,
    "lake-stage",
    "environmental-flood",
    `data_version=${args.dataVersion}`
  );
  const publishedVersionRootPath = join(
    args.context.lakeDatasetRoot,
    `data_version=${args.dataVersion}`
  );
  const bandOutputs: readonly FloodCanonicalGeoParquetBandOutput[] = FLOOD_BANDS.map((band) => ({
    band,
    outputPath: buildBandOutputPath({
      band,
      rootPath: stageVersionRootPath,
    }),
  }));

  return {
    artifact: {
      format: "geoparquet",
      layer: FLOOD_CANONICAL_LAYER,
      partitionKeys: ["data_version", "flood_band", "source_state_unit"],
      phase: "lake-spatial",
      relativePath: normalizeManifestRelativePath(`data_version=${args.dataVersion}`),
    },
    bandOutputs,
    publishedVersionRootPath,
    stageVersionRootPath,
  };
}

function buildFloodBandWhereClause(band: FloodCanonicalGeoParquetBand): string {
  if (band === "100") {
    return "WHERE is_flood_100 = TRUE";
  }
  if (band === "500") {
    return "WHERE is_flood_500 = TRUE";
  }

  return "";
}

function buildFloodBandCopySql(args: {
  readonly band: FloodCanonicalGeoParquetBand;
  readonly outputPath: string;
}): string {
  const whereClause = buildFloodBandWhereClause(args.band);

  return `COPY (
  SELECT
    feature_id,
    dfirm_id,
    fld_zone,
    zone_subty,
    sfha_tf,
    source_cit,
    is_flood_100,
    is_flood_500,
    legend_key,
    data_version,
    run_id,
    ST_XMin(geom) AS xmin,
    ST_YMin(geom) AS ymin,
    ST_XMax(geom) AS xmax,
    ST_YMax(geom) AS ymax,
    geom
  FROM flood_source
  ${whereClause}
) TO ${toSqlStringLiteral(args.outputPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`;
}

export function buildFloodCanonicalGeoParquetSql(
  args: Pick<FloodCanonicalGeoParquetWriteArgs, "databaseUrl" | "runId"> & {
    readonly spec: FloodCanonicalGeoParquetArtifactSpec;
  }
): string {
  const postgresSourceSql = `SELECT
  feature_id,
  dfirm_id,
  fld_zone,
  zone_subty,
  sfha_tf,
  source_cit,
  is_flood_100,
  is_flood_500,
  legend_key,
  data_version,
  run_id,
  ST_AsBinary(geom) AS geom_wkb
FROM environmental_current.flood_hazard
WHERE run_id = ${toSqlStringLiteral(args.runId)}`;
  const copyStatements = args.spec.bandOutputs
    .map((bandOutput) =>
      buildFloodBandCopySql({
        band: bandOutput.band,
        outputPath: bandOutput.outputPath,
      })
    )
    .join("\n\n");

  return `ATTACH ${toSqlStringLiteral(args.databaseUrl)} AS flood_pg (TYPE POSTGRES);

CREATE OR REPLACE TEMP VIEW flood_source AS
SELECT
  feature_id,
  dfirm_id,
  fld_zone,
  zone_subty,
  sfha_tf,
  source_cit,
  is_flood_100,
  is_flood_500,
  legend_key,
  data_version,
  run_id,
  ST_GeomFromWKB(geom_wkb) AS geom
FROM postgres_query('flood_pg', ${toSqlStringLiteral(postgresSourceSql)});

${copyStatements}`;
}

function decodeCountRow(output: string): FloodCanonicalGeoParquetValidationCounts | null {
  const countLine = output
    .split("\n")
    .map((line) => line.trim())
    .reverse()
    .find((line) => PSQL_COUNT_ROW_RE.test(line));
  if (typeof countLine !== "string") {
    return null;
  }

  const match = countLine.match(PSQL_COUNT_ROW_RE);
  const fullCount = readNullableNumber(match?.[1]);
  const flood100Count = readNullableNumber(match?.[2]);
  const flood500Count = readNullableNumber(match?.[3]);
  if (fullCount === null || flood100Count === null || flood500Count === null) {
    return null;
  }

  return {
    "100": flood100Count,
    "500": flood500Count,
    full: fullCount,
  };
}

function buildFloodExpectedCountsSql(runId: string): string {
  return `SELECT
  COUNT(*)::bigint AS full_count,
  COUNT(*) FILTER (WHERE is_flood_100)::bigint AS flood_100_count,
  COUNT(*) FILTER (WHERE is_flood_500)::bigint AS flood_500_count
FROM environmental_current.flood_hazard
WHERE run_id = ${toSqlStringLiteral(runId)};`;
}

async function queryExpectedFloodCounts(
  args: Pick<FloodCanonicalGeoParquetWriteArgs, "databaseUrl" | "env" | "runId">
): Promise<FloodCanonicalGeoParquetValidationCounts> {
  const result = await runBufferedCommand({
    args: [
      args.databaseUrl,
      "-At",
      "-F",
      "\t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      buildFloodExpectedCountsSql(args.runId),
    ],
    command: "psql",
    env: copyProcessEnvironment(args.env),
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `flood expected-count query failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  const counts = decodeCountRow(result.stdout);
  if (counts === null) {
    throw new Error("flood expected-count query did not return parseable counts");
  }
  if (counts.full === 0) {
    throw new Error(`environmental_current.flood_hazard has no rows for run_id=${args.runId}`);
  }

  return counts;
}

function buildFloodValidationSql(spec: FloodCanonicalGeoParquetArtifactSpec): string {
  return spec.bandOutputs
    .map((bandOutput) => {
      const bandLabel = bandOutput.band;
      return `SELECT
  ${toSqlStringLiteral(bandLabel)} AS flood_band,
  typeof(geom) AS geometry_type,
  COUNT(*)::bigint AS row_count,
  SUM(CASE WHEN geom IS NULL THEN 1 ELSE 0 END)::bigint AS null_geom_count,
  MIN(xmin) AS min_xmin,
  MAX(xmax) AS max_xmax,
  MIN(ST_XMin(geom)) AS min_geom_xmin,
  MAX(ST_XMax(geom)) AS max_geom_xmax
FROM read_parquet(${toSqlStringLiteral(bandOutput.outputPath)}, hive_partitioning = false)`;
    })
    .join("\nUNION ALL\n");
}

export async function validateFloodCanonicalGeoParquetOutput(
  args: Pick<FloodCanonicalGeoParquetWriteArgs, "context" | "databaseUrl" | "env" | "runId"> & {
    readonly spec: FloodCanonicalGeoParquetArtifactSpec;
  }
): Promise<FloodCanonicalGeoParquetValidationCounts> {
  const expectedCounts = await queryExpectedFloodCounts(args);

  const result = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    outputMode: "json",
    sql: buildFloodValidationSql(args.spec),
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `flood GeoParquet validation failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  const rows = decodeValidationRows(decodeDuckDbJsonRows(result.stdout));
  if (rows.length !== FLOOD_BANDS.length) {
    throw new Error("flood GeoParquet validation did not return all expected flood bands");
  }

  const actualCounts = collectFloodValidationCounts(rows);

  if (actualCounts.full !== expectedCounts.full) {
    throw new Error(
      `flood GeoParquet full count mismatch: expected ${String(expectedCounts.full)}, got ${String(actualCounts.full)}`
    );
  }
  if (actualCounts["100"] !== expectedCounts["100"]) {
    throw new Error(
      `flood GeoParquet 100 count mismatch: expected ${String(expectedCounts["100"])}, got ${String(actualCounts["100"])}`
    );
  }
  if (actualCounts["500"] !== expectedCounts["500"]) {
    throw new Error(
      `flood GeoParquet 500 count mismatch: expected ${String(expectedCounts["500"])}, got ${String(actualCounts["500"])}`
    );
  }

  return actualCounts;
}

function assertFloodValidationRow(row: FloodCanonicalGeoParquetValidationRow): void {
  if (row.geometry_type !== "GEOMETRY") {
    throw new Error(
      `flood GeoParquet ${row.flood_band} band did not decode as GEOMETRY (got ${row.geometry_type})`
    );
  }
  if (row.null_geom_count !== 0) {
    throw new Error(`flood GeoParquet ${row.flood_band} band contains null geometries`);
  }
  if (row.min_xmin === null || row.max_xmax === null) {
    throw new Error(`flood GeoParquet ${row.flood_band} band is missing bbox values`);
  }
  if (row.min_geom_xmin === null || row.max_geom_xmax === null) {
    throw new Error(
      `flood GeoParquet ${row.flood_band} band did not expose readable geometry bounds`
    );
  }
}

function collectFloodValidationCounts(
  rows: readonly FloodCanonicalGeoParquetValidationRow[]
): FloodCanonicalGeoParquetValidationCounts {
  let hundredYearCount = 0;
  let fiveHundredYearCount = 0;
  let fullCount = 0;

  for (const row of rows) {
    assertFloodValidationRow(row);

    if (row.flood_band === "100") {
      hundredYearCount = row.row_count;
      continue;
    }
    if (row.flood_band === "500") {
      fiveHundredYearCount = row.row_count;
      continue;
    }

    fullCount = row.row_count;
  }

  return {
    "100": hundredYearCount,
    "500": fiveHundredYearCount,
    full: fullCount,
  };
}

function publishStagedFloodVersion(spec: FloodCanonicalGeoParquetArtifactSpec): void {
  const targetParentDir = dirname(spec.publishedVersionRootPath);
  const tempTargetPath = `${spec.publishedVersionRootPath}.tmp-${process.pid}-${Date.now()}`;
  const backupTargetPath = `${spec.publishedVersionRootPath}.bak-${process.pid}-${Date.now()}`;
  const hasExistingTarget = existsSync(spec.publishedVersionRootPath);

  ensureDirectory(targetParentDir);
  rmSync(tempTargetPath, {
    force: true,
    recursive: true,
  });
  rmSync(backupTargetPath, {
    force: true,
    recursive: true,
  });
  cpSync(spec.stageVersionRootPath, tempTargetPath, {
    recursive: true,
  });

  if (hasExistingTarget) {
    renameSync(spec.publishedVersionRootPath, backupTargetPath);
  }

  try {
    renameSync(tempTargetPath, spec.publishedVersionRootPath);
  } catch (error) {
    if (
      hasExistingTarget &&
      existsSync(backupTargetPath) &&
      !existsSync(spec.publishedVersionRootPath)
    ) {
      renameSync(backupTargetPath, spec.publishedVersionRootPath);
    }
    throw error;
  }

  if (existsSync(backupTargetPath)) {
    rmSync(backupTargetPath, {
      force: true,
      recursive: true,
    });
  }
}

function prepareFloodStageOutput(spec: FloodCanonicalGeoParquetArtifactSpec): void {
  rmSync(spec.stageVersionRootPath, {
    force: true,
    recursive: true,
  });

  for (const bandOutput of spec.bandOutputs) {
    mkdirSync(dirname(bandOutput.outputPath), {
      recursive: true,
    });
  }
}

export async function writeFloodCanonicalGeoParquet(
  args: FloodCanonicalGeoParquetWriteArgs
): Promise<FloodCanonicalGeoParquetResult> {
  const spec = buildFloodCanonicalGeoParquetArtifact(args);
  prepareFloodStageOutput(spec);

  const exportResult = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    sql: buildFloodCanonicalGeoParquetSql({
      databaseUrl: args.databaseUrl,
      runId: args.runId,
      spec,
    }),
  });

  if (exportResult.exitCode !== 0) {
    throw new Error(
      `flood GeoParquet export failed: ${summarizeCommandFailure(exportResult.stdout, exportResult.stderr)}`
    );
  }

  for (const bandOutput of spec.bandOutputs) {
    if (!existsSync(bandOutput.outputPath)) {
      throw new Error(`flood GeoParquet export missing output: ${bandOutput.outputPath}`);
    }
  }

  const counts = await validateFloodCanonicalGeoParquetOutput({
    context: args.context,
    databaseUrl: args.databaseUrl,
    runId: args.runId,
    spec,
    ...(args.env === undefined ? {} : { env: args.env }),
  });

  publishStagedFloodVersion(spec);

  return {
    artifact: spec.artifact,
    counts,
    publishedVersionRootPath: spec.publishedVersionRootPath,
  };
}
