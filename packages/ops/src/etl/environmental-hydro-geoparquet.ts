import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { ensureDirectory } from "./atomic-file-store";
import { runDuckDbCli } from "./duckdb-runner";
import type {
  HydroCanonicalGeoParquetArtifactSpec,
  HydroCanonicalGeoParquetCount,
  HydroCanonicalGeoParquetFeatureKind,
  HydroCanonicalGeoParquetHucLevel,
  HydroCanonicalGeoParquetOutput,
  HydroCanonicalGeoParquetResult,
  HydroCanonicalGeoParquetValidationRow,
  HydroCanonicalGeoParquetWriteArgs,
} from "./environmental-hydro-geoparquet.types";

const SQL_STRING_ESCAPE_RE = /'/g;
const JSON_PAYLOAD_START_RE = /[[{]/;
const HYDRO_CANONICAL_LAYER = "hydro_huc";
const PARQUET_FILE_NAME = "part-0.parquet";

interface HydroCanonicalOutputDefinition {
  readonly featureKind: HydroCanonicalGeoParquetFeatureKind;
  readonly hucLevel: HydroCanonicalGeoParquetHucLevel;
}

const HYDRO_CANONICAL_OUTPUT_MATRIX: readonly HydroCanonicalOutputDefinition[] = [
  {
    featureKind: "polygon",
    hucLevel: 4,
  },
  {
    featureKind: "line",
    hucLevel: 4,
  },
  {
    featureKind: "label",
    hucLevel: 4,
  },
  {
    featureKind: "polygon",
    hucLevel: 6,
  },
  {
    featureKind: "line",
    hucLevel: 6,
  },
  {
    featureKind: "label",
    hucLevel: 6,
  },
  {
    featureKind: "polygon",
    hucLevel: 8,
  },
  {
    featureKind: "line",
    hucLevel: 8,
  },
  {
    featureKind: "label",
    hucLevel: 8,
  },
  {
    featureKind: "polygon",
    hucLevel: 10,
  },
  {
    featureKind: "line",
    hucLevel: 10,
  },
  {
    featureKind: "label",
    hucLevel: 10,
  },
  {
    featureKind: "polygon",
    hucLevel: 12,
  },
  {
    featureKind: "line",
    hucLevel: 12,
  },
];

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function normalizeManifestRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
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

function readHydroHucLevel(value: unknown): HydroCanonicalGeoParquetHucLevel | null {
  const numeric = readNullableNumber(value);
  if (numeric === 4 || numeric === 6 || numeric === 8 || numeric === 10 || numeric === 12) {
    return numeric;
  }

  return null;
}

function readHydroFeatureKind(value: unknown): HydroCanonicalGeoParquetFeatureKind | null {
  if (value === "polygon" || value === "line" || value === "label") {
    return value;
  }

  return null;
}

function hydroFeatureKindOrder(featureKind: HydroCanonicalGeoParquetFeatureKind): number {
  if (featureKind === "polygon") {
    return 0;
  }
  if (featureKind === "line") {
    return 1;
  }

  return 2;
}

function compareHydroOutputOrder(
  left: Pick<HydroCanonicalOutputDefinition, "featureKind" | "hucLevel">,
  right: Pick<HydroCanonicalOutputDefinition, "featureKind" | "hucLevel">
): number {
  if (left.hucLevel !== right.hucLevel) {
    return left.hucLevel - right.hucLevel;
  }

  return hydroFeatureKindOrder(left.featureKind) - hydroFeatureKindOrder(right.featureKind);
}

function compareHydroValidationRowOrder(
  left: Pick<HydroCanonicalGeoParquetValidationRow, "feature_kind" | "huc_level">,
  right: Pick<HydroCanonicalGeoParquetValidationRow, "feature_kind" | "huc_level">
): number {
  if (left.huc_level !== right.huc_level) {
    return left.huc_level - right.huc_level;
  }

  return hydroFeatureKindOrder(left.feature_kind) - hydroFeatureKindOrder(right.feature_kind);
}

function buildHydroOutputPath(args: {
  readonly featureKind: HydroCanonicalGeoParquetFeatureKind;
  readonly hucLevel: HydroCanonicalGeoParquetHucLevel;
  readonly rootPath: string;
}): string {
  return join(
    args.rootPath,
    `huc_level=${String(args.hucLevel)}`,
    `feature_kind=${args.featureKind}`,
    PARQUET_FILE_NAME
  );
}

export function buildHydroCanonicalGeoParquetArtifact(
  args: Pick<HydroCanonicalGeoParquetWriteArgs, "context" | "dataVersion">
): HydroCanonicalGeoParquetArtifactSpec {
  const stageVersionRootPath = join(
    args.context.runDir,
    "lake-stage",
    "environmental-hydro-basins",
    `data_version=${args.dataVersion}`
  );
  const publishedVersionRootPath = join(
    args.context.lakeDatasetRoot,
    `data_version=${args.dataVersion}`
  );
  const outputs: readonly HydroCanonicalGeoParquetOutput[] = HYDRO_CANONICAL_OUTPUT_MATRIX.map(
    (output) => ({
      featureKind: output.featureKind,
      hucLevel: output.hucLevel,
      outputPath: buildHydroOutputPath({
        featureKind: output.featureKind,
        hucLevel: output.hucLevel,
        rootPath: stageVersionRootPath,
      }),
    })
  );

  return {
    artifact: {
      format: "geoparquet",
      layer: HYDRO_CANONICAL_LAYER,
      partitionKeys: ["data_version", "huc_level", "feature_kind"],
      phase: "lake-spatial",
      relativePath: normalizeManifestRelativePath(`data_version=${args.dataVersion}`),
    },
    outputs,
    publishedVersionRootPath,
    stageVersionRootPath,
  };
}

function buildHydroPolygonSourceSql(runId: string): string {
  return `SELECT
  feature_id,
  huc_level,
  huc,
  name,
  areasqkm,
  states,
  data_version,
  run_id,
  ST_AsBinary(geom) AS geom_wkb
FROM environmental_current.hydro_huc_polygons
WHERE run_id = ${toSqlStringLiteral(runId)}`;
}

function buildHydroLineSourceSql(runId: string): string {
  return `SELECT
  feature_id,
  huc_level,
  data_version,
  run_id,
  ST_AsBinary(geom) AS geom_wkb
FROM environmental_current.hydro_huc_lines
WHERE run_id = ${toSqlStringLiteral(runId)}`;
}

function buildHydroLabelSourceSql(runId: string): string {
  return `SELECT
  feature_id,
  huc_level,
  huc,
  name,
  areasqkm,
  label_rank,
  states,
  data_version,
  run_id,
  ST_AsBinary(geom) AS geom_wkb
FROM environmental_current.hydro_huc_labels
WHERE run_id = ${toSqlStringLiteral(runId)}`;
}

export function buildHydroProjectionSql(
  output: Pick<HydroCanonicalGeoParquetOutput, "featureKind" | "hucLevel">
): string {
  const whereClause = `WHERE huc_level = ${String(output.hucLevel)}`;
  if (output.featureKind === "polygon") {
    return `SELECT
    feature_id,
    huc,
    name,
    areasqkm,
    states,
    data_version,
    run_id,
    ST_XMin(geom) AS xmin,
    ST_YMin(geom) AS ymin,
    ST_XMax(geom) AS xmax,
    ST_YMax(geom) AS ymax,
    geom
  FROM hydro_polygon_source
  ${whereClause}`;
  }

  if (output.featureKind === "line") {
    return `SELECT
    feature_id,
    data_version,
    run_id,
    ST_XMin(geom) AS xmin,
    ST_YMin(geom) AS ymin,
    ST_XMax(geom) AS xmax,
    ST_YMax(geom) AS ymax,
    geom
  FROM hydro_line_source
  ${whereClause}`;
  }

  return `SELECT
    feature_id,
    huc,
    name,
    areasqkm,
    label_rank,
    states,
    data_version,
    run_id,
    ST_XMin(geom) AS xmin,
    ST_YMin(geom) AS ymin,
    ST_XMax(geom) AS xmax,
    ST_YMax(geom) AS ymax,
    geom
  FROM hydro_label_source
  ${whereClause}`;
}

export function buildHydroCopySql(output: HydroCanonicalGeoParquetOutput): string {
  return `COPY (
  ${buildHydroProjectionSql(output)}
) TO ${toSqlStringLiteral(output.outputPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`;
}

export function buildHydroCanonicalGeoParquetSql(
  args: Pick<HydroCanonicalGeoParquetWriteArgs, "databaseUrl" | "runId"> & {
    readonly spec: HydroCanonicalGeoParquetArtifactSpec;
  }
): string {
  const copyStatements = args.spec.outputs.map(buildHydroCopySql).join("\n\n");

  return `ATTACH ${toSqlStringLiteral(args.databaseUrl)} AS hydro_pg (TYPE POSTGRES);

CREATE OR REPLACE TEMP VIEW hydro_polygon_source AS
SELECT
  feature_id,
  huc_level,
  huc,
  name,
  areasqkm,
  states,
  data_version,
  run_id,
  ST_GeomFromWKB(geom_wkb) AS geom
FROM postgres_query('hydro_pg', ${toSqlStringLiteral(buildHydroPolygonSourceSql(args.runId))});

CREATE OR REPLACE TEMP VIEW hydro_line_source AS
SELECT
  feature_id,
  huc_level,
  data_version,
  run_id,
  ST_GeomFromWKB(geom_wkb) AS geom
FROM postgres_query('hydro_pg', ${toSqlStringLiteral(buildHydroLineSourceSql(args.runId))});

CREATE OR REPLACE TEMP VIEW hydro_label_source AS
SELECT
  feature_id,
  huc_level,
  huc,
  name,
  areasqkm,
  label_rank,
  states,
  data_version,
  run_id,
  ST_GeomFromWKB(geom_wkb) AS geom
FROM postgres_query('hydro_pg', ${toSqlStringLiteral(buildHydroLabelSourceSql(args.runId))});

${copyStatements}
`;
}

function decodeHydroCountRows(
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly HydroCanonicalGeoParquetCount[] {
  return rows.flatMap((row) => {
    const hucLevel = readHydroHucLevel(row.huc_level);
    const featureKind = readHydroFeatureKind(row.feature_kind);
    const rowCount = readNullableNumber(row.row_count);

    if (hucLevel === null || featureKind === null || rowCount === null) {
      return [];
    }

    return [
      {
        featureKind,
        hucLevel,
        rowCount,
      },
    ];
  });
}

export async function readHydroCanonicalExpectedCounts(
  args: Pick<HydroCanonicalGeoParquetWriteArgs, "context" | "databaseUrl" | "env" | "runId">
): Promise<readonly HydroCanonicalGeoParquetCount[]> {
  const postgresCountsSql = `SELECT
  huc_level,
  feature_kind,
  row_count
FROM (
  SELECT
    huc_level,
    'polygon' AS feature_kind,
    COUNT(*)::bigint AS row_count
  FROM environmental_current.hydro_huc_polygons
  WHERE run_id = ${toSqlStringLiteral(args.runId)}
  GROUP BY huc_level

  UNION ALL

  SELECT
    huc_level,
    'line' AS feature_kind,
    COUNT(*)::bigint AS row_count
  FROM environmental_current.hydro_huc_lines
  WHERE run_id = ${toSqlStringLiteral(args.runId)}
  GROUP BY huc_level

  UNION ALL

  SELECT
    huc_level,
    'label' AS feature_kind,
    COUNT(*)::bigint AS row_count
  FROM environmental_current.hydro_huc_labels
  WHERE run_id = ${toSqlStringLiteral(args.runId)}
  GROUP BY huc_level
) AS hydro_counts
ORDER BY
  huc_level ASC,
  CASE feature_kind
    WHEN 'polygon' THEN 0
    WHEN 'line' THEN 1
    ELSE 2
  END ASC`;

  const result = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    outputMode: "json",
    sql: `ATTACH ${toSqlStringLiteral(args.databaseUrl)} AS hydro_pg (TYPE POSTGRES);

SELECT
  huc_level,
  feature_kind,
  row_count
FROM postgres_query('hydro_pg', ${toSqlStringLiteral(postgresCountsSql)});`,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `hydro GeoParquet expected-count query failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  const counts = [...decodeHydroCountRows(decodeDuckDbJsonRows(result.stdout))].sort(
    compareHydroOutputOrder
  );
  for (const count of counts) {
    if (count.featureKind === "label" && count.hucLevel === 12) {
      throw new Error(
        "hydro canonical expected counts included unsupported huc_level=12 label rows"
      );
    }
  }

  return counts;
}

function buildHydroValidationSql(spec: HydroCanonicalGeoParquetArtifactSpec): string {
  return spec.outputs
    .map(
      (output) => `SELECT
  ${String(output.hucLevel)}::integer AS huc_level,
  ${toSqlStringLiteral(output.featureKind)} AS feature_kind,
  ANY_VALUE(typeof(geom_value)) AS geometry_type,
  COUNT(*)::bigint AS row_count,
  SUM(CASE WHEN geom_value IS NULL THEN 1 ELSE 0 END)::bigint AS null_geom_count,
  MIN(xmin) AS min_xmin,
  MAX(xmax) AS max_xmax,
  MIN(ST_XMin(geom_value)) AS min_geom_xmin,
  MAX(ST_XMax(geom_value)) AS max_geom_xmax
FROM (
  SELECT
    *,
    ST_GeomFromWKB(geom) AS geom_value
  FROM read_parquet(${toSqlStringLiteral(output.outputPath)}, hive_partitioning = false)
) AS hydro_rows`
    )
    .join("\nUNION ALL\n");
}

function decodeHydroValidationRows(
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly HydroCanonicalGeoParquetValidationRow[] {
  return rows.flatMap((row) => {
    const hucLevel = readHydroHucLevel(row.huc_level);
    const featureKind = readHydroFeatureKind(row.feature_kind);
    const geometryType = row.geometry_type;
    const rowCount = readNullableNumber(row.row_count);
    const nullGeomCount = readNullableNumber(row.null_geom_count);

    if (
      hucLevel === null ||
      featureKind === null ||
      typeof geometryType !== "string" ||
      rowCount === null ||
      nullGeomCount === null
    ) {
      return [];
    }

    return [
      {
        feature_kind: featureKind,
        geometry_type: geometryType,
        huc_level: hucLevel,
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

function isDuckDbGeometryType(value: string): boolean {
  return value === "GEOMETRY" || value.startsWith("GEOMETRY(");
}

function assertHydroValidationRow(row: HydroCanonicalGeoParquetValidationRow): void {
  if (!isDuckDbGeometryType(row.geometry_type)) {
    throw new Error(
      `hydro GeoParquet huc${String(row.huc_level)} ${row.feature_kind} did not decode as GEOMETRY (got ${row.geometry_type})`
    );
  }
  if (row.null_geom_count !== 0) {
    throw new Error(
      `hydro GeoParquet huc${String(row.huc_level)} ${row.feature_kind} contains null geometries`
    );
  }
  if (row.row_count > 0 && (row.min_xmin === null || row.max_xmax === null)) {
    throw new Error(
      `hydro GeoParquet huc${String(row.huc_level)} ${row.feature_kind} is missing bbox values`
    );
  }
  if (row.row_count > 0 && (row.min_geom_xmin === null || row.max_geom_xmax === null)) {
    throw new Error(
      `hydro GeoParquet huc${String(row.huc_level)} ${row.feature_kind} did not expose readable geometry bounds`
    );
  }
}

function countKey(args: {
  readonly featureKind: HydroCanonicalGeoParquetFeatureKind;
  readonly hucLevel: HydroCanonicalGeoParquetHucLevel;
}): string {
  return `${String(args.hucLevel)}:${args.featureKind}`;
}

function collectHydroValidationCounts(
  rows: readonly HydroCanonicalGeoParquetValidationRow[]
): readonly HydroCanonicalGeoParquetCount[] {
  return rows
    .map((row) => {
      assertHydroValidationRow(row);
      return {
        featureKind: row.feature_kind,
        hucLevel: row.huc_level,
        rowCount: row.row_count,
      };
    })
    .sort(compareHydroOutputOrder);
}

function buildHydroExpectedCountMap(
  counts: readonly HydroCanonicalGeoParquetCount[]
): Map<string, number> {
  const expected = new Map<string, number>();
  for (const count of counts) {
    expected.set(
      countKey({
        featureKind: count.featureKind,
        hucLevel: count.hucLevel,
      }),
      count.rowCount
    );
  }

  return expected;
}

export async function validateHydroCanonicalGeoParquetOutput(
  args: Pick<HydroCanonicalGeoParquetWriteArgs, "context" | "env"> & {
    readonly expectedCounts: readonly HydroCanonicalGeoParquetCount[];
    readonly spec: HydroCanonicalGeoParquetArtifactSpec;
  }
): Promise<readonly HydroCanonicalGeoParquetCount[]> {
  const result = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    outputMode: "json",
    sql: buildHydroValidationSql(args.spec),
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `hydro GeoParquet validation failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  const rows = [...decodeHydroValidationRows(decodeDuckDbJsonRows(result.stdout))].sort(
    compareHydroValidationRowOrder
  );
  if (rows.length !== HYDRO_CANONICAL_OUTPUT_MATRIX.length) {
    throw new Error("hydro GeoParquet validation did not return all expected huc outputs");
  }

  const actualCounts = collectHydroValidationCounts(rows);
  const expectedCountMap = buildHydroExpectedCountMap(args.expectedCounts);

  for (const output of HYDRO_CANONICAL_OUTPUT_MATRIX) {
    const key = countKey(output);
    const actualCount = actualCounts.find(
      (count) => count.hucLevel === output.hucLevel && count.featureKind === output.featureKind
    )?.rowCount;
    const expectedCount = expectedCountMap.get(key) ?? 0;

    if (typeof actualCount !== "number") {
      throw new Error(
        `hydro GeoParquet validation did not produce a count for huc${String(output.hucLevel)} ${output.featureKind}`
      );
    }
    if (actualCount !== expectedCount) {
      throw new Error(
        `hydro GeoParquet count mismatch for huc${String(output.hucLevel)} ${output.featureKind}: expected ${String(expectedCount)}, got ${String(actualCount)}`
      );
    }
  }

  return actualCounts;
}

function publishStagedHydroVersion(spec: HydroCanonicalGeoParquetArtifactSpec): void {
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

function prepareHydroStageOutput(spec: HydroCanonicalGeoParquetArtifactSpec): void {
  rmSync(spec.stageVersionRootPath, {
    force: true,
    recursive: true,
  });

  for (const output of spec.outputs) {
    mkdirSync(dirname(output.outputPath), {
      recursive: true,
    });
  }
}

export async function writeHydroCanonicalGeoParquet(
  args: HydroCanonicalGeoParquetWriteArgs
): Promise<HydroCanonicalGeoParquetResult> {
  const spec = buildHydroCanonicalGeoParquetArtifact(args);
  prepareHydroStageOutput(spec);

  const exportResult = await runDuckDbCli({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    ...(args.env === undefined ? {} : { env: args.env }),
    sql: buildHydroCanonicalGeoParquetSql({
      databaseUrl: args.databaseUrl,
      runId: args.runId,
      spec,
    }),
  });

  if (exportResult.exitCode !== 0) {
    throw new Error(
      `hydro GeoParquet export failed: ${summarizeCommandFailure(exportResult.stdout, exportResult.stderr)}`
    );
  }

  for (const output of spec.outputs) {
    if (!existsSync(output.outputPath)) {
      throw new Error(`hydro GeoParquet export missing output: ${output.outputPath}`);
    }
  }

  const expectedCounts = await readHydroCanonicalExpectedCounts({
    context: args.context,
    databaseUrl: args.databaseUrl,
    ...(args.env === undefined ? {} : { env: args.env }),
    runId: args.runId,
  });
  const counts = await validateHydroCanonicalGeoParquetOutput({
    context: args.context,
    ...(args.env === undefined ? {} : { env: args.env }),
    expectedCounts,
    spec,
  });

  publishStagedHydroVersion(spec);
  rmSync(spec.stageVersionRootPath, {
    force: true,
    recursive: true,
  });

  return {
    artifact: spec.artifact,
    counts,
    publishedVersionRootPath: spec.publishedVersionRootPath,
  };
}
