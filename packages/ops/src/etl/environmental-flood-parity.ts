import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ensureDirectory, fileExists, writeTextAtomic } from "./atomic-file-store";
import { mergeLakeManifestArtifacts } from "./batch-artifact-layout";
import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import { writeDuckDbBootstrapSql } from "./duckdb-bootstrap";
import { runDuckDbCli } from "./duckdb-runner";
import type {
  EnvironmentalFloodParityAssertionRecord,
  EnvironmentalFloodParityDuckDbRunner,
  EnvironmentalFloodParityProfileRecord,
  EnvironmentalFloodParityResult,
  EnvironmentalFloodParityTargetName,
  EnvironmentalFloodParityTargetSpec,
  EnvironmentalFloodParityValidationArgs,
} from "./environmental-flood-parity.types";
import type { FloodPlanetilerOverlayKind } from "./environmental-planetiler-inputs.types";

const DUCKDB_JSON_CAPTURE_MAX_BYTES = 32_000_000;
const FLOAT_TOLERANCE = 0.001;
const JSON_PAYLOAD_START_RE = /\[|{/;
const OVERLAY_LAYER_NAME = "flood_overlay";
const QA_ASSERTIONS_RELATIVE_PATH = "qa/assertions.parquet";
const QA_PROFILE_RELATIVE_PATH = "qa/profile.parquet";
const SQL_STRING_ESCAPE_RE = /'/g;
const TARGET_SEPARATOR = "\u001e";

interface DatasetProfileRow {
  readonly distinct_dfirm_id_count: number;
  readonly distinct_legend_key_count: number;
  readonly group_count: number;
  readonly max_xmax: number | null;
  readonly max_ymax: number | null;
  readonly min_xmin: number | null;
  readonly min_ymin: number | null;
  readonly row_count: number;
  readonly source_name: "geopackage" | "postgres";
}

interface GroupComparisonRow {
  readonly data_version: string;
  readonly dfirm_id: string;
  readonly flood_band: string;
  readonly geopackage_area_m2: number | null;
  readonly geopackage_row_count: number | null;
  readonly legend_key: string;
  readonly postgres_area_m2: number | null;
  readonly postgres_row_count: number | null;
  readonly symmetric_difference_area_m2: number | null;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
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

function decodeString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected ${fieldName} to be a string`);
  }

  return value;
}

function decodeNullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error("Expected numeric field to be a finite number or null");
}

function decodeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected ${fieldName} to be an integer`);
  }

  return value;
}

function decodeDatasetProfileRows(
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly DatasetProfileRow[] {
  return rows.map((row) => ({
    distinct_dfirm_id_count: decodeInteger(row.distinct_dfirm_id_count, "distinct_dfirm_id_count"),
    distinct_legend_key_count: decodeInteger(
      row.distinct_legend_key_count,
      "distinct_legend_key_count"
    ),
    group_count: decodeInteger(row.group_count, "group_count"),
    max_xmax: decodeNullableNumber(row.max_xmax),
    max_ymax: decodeNullableNumber(row.max_ymax),
    min_xmin: decodeNullableNumber(row.min_xmin),
    min_ymin: decodeNullableNumber(row.min_ymin),
    row_count: decodeInteger(row.row_count, "row_count"),
    source_name:
      decodeString(row.source_name, "source_name") === "postgres" ? "postgres" : "geopackage",
  }));
}

function decodeGroupComparisonRows(
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly GroupComparisonRow[] {
  return rows.map((row) => ({
    data_version: decodeString(row.data_version, "data_version"),
    dfirm_id: decodeString(row.dfirm_id, "dfirm_id"),
    flood_band: decodeString(row.flood_band, "flood_band"),
    geopackage_area_m2: decodeNullableNumber(row.geopackage_area_m2),
    geopackage_row_count:
      row.geopackage_row_count === null
        ? null
        : decodeInteger(row.geopackage_row_count, "geopackage_row_count"),
    legend_key: decodeString(row.legend_key, "legend_key"),
    postgres_area_m2: decodeNullableNumber(row.postgres_area_m2),
    postgres_row_count:
      row.postgres_row_count === null
        ? null
        : decodeInteger(row.postgres_row_count, "postgres_row_count"),
    symmetric_difference_area_m2: decodeNullableNumber(row.symmetric_difference_area_m2),
  }));
}

function encodeNdjsonRows(rows: readonly unknown[]): string {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  return content.length > 0 ? `${content}\n` : "";
}

function buildQaArtifacts(): readonly LakeManifestArtifactRecord[] {
  return [
    {
      format: "parquet",
      layer: "parity_assertions",
      partitionKeys: [],
      phase: "qa-plain",
      relativePath: QA_ASSERTIONS_RELATIVE_PATH,
    },
    {
      format: "parquet",
      layer: "parity_profile",
      partitionKeys: [],
      phase: "qa-plain",
      relativePath: QA_PROFILE_RELATIVE_PATH,
    },
  ];
}

function ensureDuckDbControlSurface(
  context: EnvironmentalFloodParityValidationArgs["context"]
): void {
  ensureDirectory(context.runDuckDbDir);
  if (!fileExists(context.runDuckDbBootstrapPath)) {
    writeDuckDbBootstrapSql(context.runDuckDbBootstrapPath);
  }
  ensureDirectory(context.qaDir);
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

export function buildEnvironmentalFloodParityTargetSpecs(args: {
  readonly outputRoot: string;
  readonly overlayKinds: readonly FloodPlanetilerOverlayKind[];
}): readonly EnvironmentalFloodParityTargetSpec[] {
  return args.overlayKinds.map((overlayKind) => ({
    gpkgPath: join(args.outputRoot, `flood-overlay-${overlayKind}.gpkg`),
    name: overlayKind === "100" ? "flood_overlay_100" : "flood_overlay_500",
    overlayKind,
  }));
}

function buildOverlayGroupKey(row: GroupComparisonRow): string {
  return [row.dfirm_id, row.flood_band, row.legend_key, row.data_version].join(TARGET_SEPARATOR);
}

function buildOverlayBindingsSql(args: {
  readonly databaseUrl: string;
  readonly gpkgPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runId: string;
}): string {
  const overlayPredicate = args.overlayKind === "100" ? "is_flood_100" : "is_flood_500";
  const expectedFloodBand = args.overlayKind;
  const expectedLegendKey = `flood-${args.overlayKind}`;

  return `ATTACH ${toSqlStringLiteral(args.databaseUrl)} AS flood_pg (TYPE POSTGRES);

CREATE OR REPLACE TEMP VIEW postgres_overlay AS
SELECT
  COALESCE(dfirm_id, 'unknown') AS dfirm_id,
  CASE
    WHEN flood_band IN ('100', 'flood-100') THEN '100'
    WHEN flood_band IN ('500', 'flood-500') THEN '500'
    ELSE flood_band
  END AS flood_band,
  CASE
    WHEN legend_key IS NULL THEN ${toSqlStringLiteral(expectedLegendKey)}
    WHEN legend_key IN ('100', 'flood-100') THEN 'flood-100'
    WHEN legend_key IN ('500', 'flood-500') THEN 'flood-500'
    ELSE legend_key
  END AS legend_key,
  data_version,
  ST_CollectionExtract(ST_MakeValid(ST_GeomFromWKB(geom_wkb)), 3) AS geom
FROM postgres_query(
  'flood_pg',
  ${toSqlStringLiteral(`SELECT
  dfirm_id,
  flood_band,
  legend_key,
  data_version,
  ST_AsBinary(geom_3857) AS geom_wkb
FROM environmental_current.flood_hazard
WHERE run_id = ${toSqlStringLiteral(args.runId)}
  AND ${overlayPredicate}`)}
);

CREATE OR REPLACE TEMP VIEW geopackage_overlay AS
SELECT
  COALESCE(dfirm_id, 'unknown') AS dfirm_id,
  CASE
    WHEN flood_band IN ('100', 'flood-100') THEN '100'
    WHEN flood_band IN ('500', 'flood-500') THEN '500'
    WHEN flood_band IS NULL THEN ${toSqlStringLiteral(expectedFloodBand)}
    ELSE flood_band
  END AS flood_band,
  CASE
    WHEN legend_key IS NULL THEN ${toSqlStringLiteral(expectedLegendKey)}
    WHEN legend_key IN ('100', 'flood-100') THEN 'flood-100'
    WHEN legend_key IN ('500', 'flood-500') THEN 'flood-500'
    ELSE legend_key
  END AS legend_key,
  data_version,
  ST_CollectionExtract(ST_MakeValid(geom), 3) AS geom
FROM ST_Read(${toSqlStringLiteral(args.gpkgPath)}, layer = ${toSqlStringLiteral(OVERLAY_LAYER_NAME)})
WHERE geom IS NOT NULL
  AND NOT ST_IsEmpty(geom);`;
}

export function buildEnvironmentalFloodParityDatasetSql(args: {
  readonly databaseUrl: string;
  readonly gpkgPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runId: string;
}): string {
  return `${buildOverlayBindingsSql(args)}

WITH postgres_groups AS (
  SELECT
    dfirm_id,
    flood_band,
    legend_key,
    data_version,
    ST_CollectionExtract(ST_MakeValid(ST_MemUnion_Agg(geom)), 3) AS geom
  FROM postgres_overlay
  GROUP BY
    1,
    2,
    3,
    4
),
geopackage_groups AS (
  SELECT
    dfirm_id,
    flood_band,
    legend_key,
    data_version,
    ST_CollectionExtract(ST_MakeValid(ST_MemUnion_Agg(geom)), 3) AS geom
  FROM geopackage_overlay
  GROUP BY
    1,
    2,
    3,
    4
)

SELECT *
FROM (
  SELECT
    'postgres' AS source_name,
    COUNT(*)::BIGINT AS row_count,
    COUNT(*)::BIGINT AS group_count,
    COUNT(DISTINCT dfirm_id)::BIGINT AS distinct_dfirm_id_count,
    COUNT(DISTINCT legend_key)::BIGINT AS distinct_legend_key_count,
    MIN(ST_XMin(geom)) AS min_xmin,
    MIN(ST_YMin(geom)) AS min_ymin,
    MAX(ST_XMax(geom)) AS max_xmax,
    MAX(ST_YMax(geom)) AS max_ymax
  FROM postgres_groups
  UNION ALL
  SELECT
    'geopackage' AS source_name,
    COUNT(*)::BIGINT AS row_count,
    COUNT(*)::BIGINT AS group_count,
    COUNT(DISTINCT dfirm_id)::BIGINT AS distinct_dfirm_id_count,
    COUNT(DISTINCT legend_key)::BIGINT AS distinct_legend_key_count,
    MIN(ST_XMin(geom)) AS min_xmin,
    MIN(ST_YMin(geom)) AS min_ymin,
    MAX(ST_XMax(geom)) AS max_xmax,
    MAX(ST_YMax(geom)) AS max_ymax
  FROM geopackage_groups
) dataset_profile
ORDER BY source_name;`;
}

export function buildEnvironmentalFloodParityGroupSql(args: {
  readonly databaseUrl: string;
  readonly gpkgPath: string;
  readonly overlayKind: FloodPlanetilerOverlayKind;
  readonly runId: string;
}): string {
  return `${buildOverlayBindingsSql(args)}

WITH postgres_groups AS (
  SELECT
    dfirm_id,
    flood_band,
    legend_key,
    data_version,
    COUNT(*)::BIGINT AS row_count,
    ST_CollectionExtract(ST_MakeValid(ST_MemUnion_Agg(geom)), 3) AS geom
  FROM postgres_overlay
  GROUP BY
    1,
    2,
    3,
    4
),
geopackage_groups AS (
  SELECT
    dfirm_id,
    flood_band,
    legend_key,
    data_version,
    COUNT(*)::BIGINT AS row_count,
    ST_CollectionExtract(ST_MakeValid(ST_MemUnion_Agg(geom)), 3) AS geom
  FROM geopackage_overlay
  GROUP BY
    1,
    2,
    3,
    4
)
SELECT
  COALESCE(postgres_groups.dfirm_id, geopackage_groups.dfirm_id) AS dfirm_id,
  COALESCE(postgres_groups.flood_band, geopackage_groups.flood_band) AS flood_band,
  COALESCE(postgres_groups.legend_key, geopackage_groups.legend_key) AS legend_key,
  COALESCE(postgres_groups.data_version, geopackage_groups.data_version) AS data_version,
  CASE
    WHEN postgres_groups.geom IS NULL THEN NULL
    ELSE 1::BIGINT
  END AS postgres_row_count,
  CASE
    WHEN geopackage_groups.geom IS NULL THEN NULL
    ELSE 1::BIGINT
  END AS geopackage_row_count,
  CASE
    WHEN postgres_groups.geom IS NULL OR geopackage_groups.geom IS NULL THEN NULL
    ELSE
      ST_Area(ST_Difference(postgres_groups.geom, geopackage_groups.geom)) +
      ST_Area(ST_Difference(geopackage_groups.geom, postgres_groups.geom))
  END AS symmetric_difference_area_m2,
  CASE
    WHEN postgres_groups.geom IS NULL THEN NULL
    ELSE ST_Area(postgres_groups.geom)
  END AS postgres_area_m2,
  CASE
    WHEN geopackage_groups.geom IS NULL THEN NULL
    ELSE ST_Area(geopackage_groups.geom)
  END AS geopackage_area_m2
FROM postgres_groups
FULL OUTER JOIN geopackage_groups
  ON postgres_groups.dfirm_id = geopackage_groups.dfirm_id
  AND postgres_groups.flood_band = geopackage_groups.flood_band
  AND postgres_groups.legend_key = geopackage_groups.legend_key
  AND postgres_groups.data_version = geopackage_groups.data_version
ORDER BY
  1,
  2,
  3,
  4;`;
}

async function readDuckDbRows(args: {
  readonly bootstrapPath: string;
  readonly cwd: string;
  readonly databasePath: string;
  readonly env: NodeJS.ProcessEnv;
  readonly runner: EnvironmentalFloodParityDuckDbRunner;
  readonly sql: string;
}): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const result = await args.runner({
    bootstrapPath: args.bootstrapPath,
    cwd: args.cwd,
    databasePath: args.databasePath,
    env: args.env,
    outputMode: "json",
    readOnly: true,
    stdoutCaptureMaxBytes: DUCKDB_JSON_CAPTURE_MAX_BYTES,
    sql: args.sql,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `environmental flood parity read failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
    );
  }

  return decodeDuckDbJsonRows(result.stdout);
}

function buildSchemaHash(): string {
  return createHash("sha256")
    .update("dfirm_id:text|flood_band:text|legend_key:text|data_version:text|geom:geometry")
    .digest("hex");
}

function stringifyValue(value: number | string | null): string | null {
  if (value === null) {
    return null;
  }

  return String(value);
}

function valuesMatchWithinTolerance(actual: number | null, expected: number | null): boolean {
  if (actual === null || expected === null) {
    return actual === expected;
  }

  return Math.abs(actual - expected) <= FLOAT_TOLERANCE;
}

function buildDatasetChecksum(args: {
  readonly groupRows: readonly GroupComparisonRow[];
  readonly sourceName: "geopackage" | "postgres";
}): string {
  const digest = createHash("sha256");

  for (const row of args.groupRows) {
    const rowCount =
      args.sourceName === "postgres" ? row.postgres_row_count : row.geopackage_row_count;
    const area = args.sourceName === "postgres" ? row.postgres_area_m2 : row.geopackage_area_m2;
    digest.update(
      `${buildOverlayGroupKey(row)}|${stringifyValue(rowCount)}|${stringifyValue(area)}\n`
    );
  }

  return digest.digest("hex");
}

function buildAssertion(args: {
  readonly actualValueText: string | null;
  readonly assertionName: string;
  readonly detailsJson: string | null;
  readonly expectedValueText: string | null;
  readonly passed: boolean;
  readonly targetName: EnvironmentalFloodParityTargetName;
  readonly validatedAt: string;
  readonly runId: string;
}): EnvironmentalFloodParityAssertionRecord {
  return {
    actual_value_text: args.actualValueText,
    assertion_name: args.assertionName,
    blocking: true,
    column_name: null,
    details_json: args.detailsJson,
    expected_value_text: args.expectedValueText,
    passed: args.passed,
    run_id: args.runId,
    severity: "error",
    target_name: args.targetName,
    validated_at: args.validatedAt,
  };
}

function buildDatasetAssertions(args: {
  readonly geopackageProfile: DatasetProfileRow;
  readonly postgresProfile: DatasetProfileRow;
  readonly runId: string;
  readonly targetName: EnvironmentalFloodParityTargetName;
  readonly validatedAt: string;
}): readonly EnvironmentalFloodParityAssertionRecord[] {
  return [
    {
      actual: args.geopackageProfile.row_count,
      expected: args.postgresProfile.row_count,
      name: "row_count",
    },
    {
      actual: args.geopackageProfile.group_count,
      expected: args.postgresProfile.group_count,
      name: "group_count",
    },
    {
      actual: args.geopackageProfile.distinct_dfirm_id_count,
      expected: args.postgresProfile.distinct_dfirm_id_count,
      name: "distinct_dfirm_id_count",
    },
    {
      actual: args.geopackageProfile.distinct_legend_key_count,
      expected: args.postgresProfile.distinct_legend_key_count,
      name: "distinct_legend_key_count",
    },
    {
      actual: args.geopackageProfile.min_xmin,
      expected: args.postgresProfile.min_xmin,
      name: "min_xmin",
    },
    {
      actual: args.geopackageProfile.min_ymin,
      expected: args.postgresProfile.min_ymin,
      name: "min_ymin",
    },
    {
      actual: args.geopackageProfile.max_xmax,
      expected: args.postgresProfile.max_xmax,
      name: "max_xmax",
    },
    {
      actual: args.geopackageProfile.max_ymax,
      expected: args.postgresProfile.max_ymax,
      name: "max_ymax",
    },
  ].map((metric) =>
    buildAssertion({
      actualValueText: stringifyValue(metric.actual),
      assertionName: metric.name,
      detailsJson: null,
      expectedValueText: stringifyValue(metric.expected),
      passed:
        typeof metric.actual === "number" || typeof metric.expected === "number"
          ? valuesMatchWithinTolerance(
              metric.actual === null || typeof metric.actual === "number" ? metric.actual : null,
              metric.expected === null || typeof metric.expected === "number"
                ? metric.expected
                : null
            )
          : metric.actual === metric.expected,
      runId: args.runId,
      targetName: args.targetName,
      validatedAt: args.validatedAt,
    })
  );
}

function buildGroupAssertions(args: {
  readonly groupRows: readonly GroupComparisonRow[];
  readonly runId: string;
  readonly targetName: EnvironmentalFloodParityTargetName;
  readonly validatedAt: string;
}): readonly EnvironmentalFloodParityAssertionRecord[] {
  return args.groupRows.flatMap((row) => {
    const detailsJson = JSON.stringify({
      dataVersion: row.data_version,
      dfirmId: row.dfirm_id,
      floodBand: row.flood_band,
      legendKey: row.legend_key,
    });

    return [
      buildAssertion({
        actualValueText: stringifyValue(row.geopackage_row_count),
        assertionName: "group_presence",
        detailsJson,
        expectedValueText: stringifyValue(row.postgres_row_count),
        passed: row.postgres_row_count !== null && row.geopackage_row_count !== null,
        runId: args.runId,
        targetName: args.targetName,
        validatedAt: args.validatedAt,
      }),
      buildAssertion({
        actualValueText: stringifyValue(row.geopackage_row_count),
        assertionName: "group_row_count",
        detailsJson,
        expectedValueText: stringifyValue(row.postgres_row_count),
        passed: row.postgres_row_count === row.geopackage_row_count,
        runId: args.runId,
        targetName: args.targetName,
        validatedAt: args.validatedAt,
      }),
      buildAssertion({
        actualValueText: stringifyValue(row.symmetric_difference_area_m2),
        assertionName: "group_symmetric_difference_area_m2",
        detailsJson,
        expectedValueText: "0",
        passed:
          row.postgres_row_count !== null &&
          row.geopackage_row_count !== null &&
          valuesMatchWithinTolerance(row.symmetric_difference_area_m2, 0),
        runId: args.runId,
        targetName: args.targetName,
        validatedAt: args.validatedAt,
      }),
    ];
  });
}

function buildProfiles(args: {
  readonly geopackageProfile: DatasetProfileRow;
  readonly groupRows: readonly GroupComparisonRow[];
  readonly postgresProfile: DatasetProfileRow;
  readonly runId: string;
  readonly targetName: EnvironmentalFloodParityTargetName;
  readonly validatedAt: string;
}): readonly EnvironmentalFloodParityProfileRecord[] {
  const schemaHash = buildSchemaHash();

  return [
    {
      canonical_schema_hash: schemaHash,
      canonical_type: null,
      column_name: null,
      max_value_text: null,
      min_value_text: null,
      null_count: null,
      observed_type: "GEOMETRY(EPSG:3857)",
      parity_checksum: buildDatasetChecksum({
        groupRows: args.groupRows,
        sourceName: "postgres",
      }),
      profile_json: JSON.stringify({
        distinctDfirmIdCount: args.postgresProfile.distinct_dfirm_id_count,
        distinctLegendKeyCount: args.postgresProfile.distinct_legend_key_count,
        groupCount: args.postgresProfile.group_count,
        maxXmax: args.postgresProfile.max_xmax,
        maxYmax: args.postgresProfile.max_ymax,
        minXmin: args.postgresProfile.min_xmin,
        minYmin: args.postgresProfile.min_ymin,
      }),
      profile_kind: "dataset",
      row_count: args.postgresProfile.row_count,
      run_id: args.runId,
      source_name: "postgres",
      target_name: args.targetName,
      validated_at: args.validatedAt,
    },
    {
      canonical_schema_hash: schemaHash,
      canonical_type: null,
      column_name: null,
      max_value_text: null,
      min_value_text: null,
      null_count: null,
      observed_type: "GEOMETRY(EPSG:3857)",
      parity_checksum: buildDatasetChecksum({
        groupRows: args.groupRows,
        sourceName: "geopackage",
      }),
      profile_json: JSON.stringify({
        distinctDfirmIdCount: args.geopackageProfile.distinct_dfirm_id_count,
        distinctLegendKeyCount: args.geopackageProfile.distinct_legend_key_count,
        groupCount: args.geopackageProfile.group_count,
        maxXmax: args.geopackageProfile.max_xmax,
        maxYmax: args.geopackageProfile.max_ymax,
        minXmin: args.geopackageProfile.min_xmin,
        minYmin: args.geopackageProfile.min_ymin,
      }),
      profile_kind: "dataset",
      row_count: args.geopackageProfile.row_count,
      run_id: args.runId,
      source_name: "geopackage",
      target_name: args.targetName,
      validated_at: args.validatedAt,
    },
  ];
}

async function writeQaArtifacts(args: {
  readonly assertions: readonly EnvironmentalFloodParityAssertionRecord[];
  readonly context: EnvironmentalFloodParityValidationArgs["context"];
  readonly env: NodeJS.ProcessEnv;
  readonly profiles: readonly EnvironmentalFloodParityProfileRecord[];
  readonly runner: EnvironmentalFloodParityDuckDbRunner;
}): Promise<void> {
  const tempDir = mkdtempSync(join(args.context.runDir, ".environmental-flood-parity-"));

  try {
    const assertionsJsonPath = join(tempDir, "assertions.ndjson");
    const profileJsonPath = join(tempDir, "profile.ndjson");
    writeTextAtomic(assertionsJsonPath, encodeNdjsonRows(args.assertions));
    writeTextAtomic(profileJsonPath, encodeNdjsonRows(args.profiles));

    const result = await args.runner({
      bootstrapPath: args.context.runDuckDbBootstrapPath,
      cwd: args.context.runDir,
      databasePath: args.context.runDuckDbPath,
      env: args.env,
      sql: `COPY (
  SELECT *
  FROM read_ndjson_auto(${toSqlStringLiteral(assertionsJsonPath)})
) TO ${toSqlStringLiteral(args.context.qaAssertionsPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  SELECT *
  FROM read_ndjson_auto(${toSqlStringLiteral(profileJsonPath)})
) TO ${toSqlStringLiteral(args.context.qaProfilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `environmental flood parity QA write failed: ${summarizeCommandFailure(result.stdout, result.stderr)}`
      );
    }
    if (!(fileExists(args.context.qaAssertionsPath) && fileExists(args.context.qaProfilePath))) {
      throw new Error("environmental flood parity QA artifacts are missing");
    }
  } finally {
    rmSync(tempDir, {
      force: true,
      recursive: true,
    });
  }
}

export async function validateEnvironmentalFloodTileInputs(
  args: EnvironmentalFloodParityValidationArgs & {
    readonly runner?: EnvironmentalFloodParityDuckDbRunner;
  }
): Promise<EnvironmentalFloodParityResult> {
  const env = args.env ?? process.env;
  const databaseUrl = env.ENVIRONMENTAL_FLOOD_DATABASE_URL ?? env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof databaseUrl !== "string" || databaseUrl.trim().length === 0) {
    throw new Error("Missing DATABASE_URL, POSTGRES_URL, or ENVIRONMENTAL_FLOOD_DATABASE_URL");
  }

  ensureDuckDbControlSurface(args.context);

  const runner = args.runner ?? runDuckDbCli;
  const validatedAt = new Date().toISOString();
  const assertions: EnvironmentalFloodParityAssertionRecord[] = [];
  const profiles: EnvironmentalFloodParityProfileRecord[] = [];
  const qaArtifacts = buildQaArtifacts();
  const targetSpecs = buildEnvironmentalFloodParityTargetSpecs({
    outputRoot: args.outputRoot,
    overlayKinds: args.overlayKinds,
  });

  for (const targetSpec of targetSpecs) {
    if (!fileExists(targetSpec.gpkgPath)) {
      throw new Error(`Missing environmental flood tile input: ${targetSpec.gpkgPath}`);
    }

    const [datasetRows, groupRows] = await Promise.all([
      readDuckDbRows({
        bootstrapPath: args.context.runDuckDbBootstrapPath,
        cwd: args.context.runDir,
        databasePath: args.context.runDuckDbPath,
        env,
        runner,
        sql: buildEnvironmentalFloodParityDatasetSql({
          databaseUrl: databaseUrl.trim(),
          gpkgPath: targetSpec.gpkgPath,
          overlayKind: targetSpec.overlayKind,
          runId: args.context.runId,
        }),
      }),
      readDuckDbRows({
        bootstrapPath: args.context.runDuckDbBootstrapPath,
        cwd: args.context.runDir,
        databasePath: args.context.runDuckDbPath,
        env,
        runner,
        sql: buildEnvironmentalFloodParityGroupSql({
          databaseUrl: databaseUrl.trim(),
          gpkgPath: targetSpec.gpkgPath,
          overlayKind: targetSpec.overlayKind,
          runId: args.context.runId,
        }),
      }),
    ]);

    const decodedDatasetRows = decodeDatasetProfileRows(datasetRows);
    const postgresProfile = decodedDatasetRows.find((row) => row.source_name === "postgres");
    const geopackageProfile = decodedDatasetRows.find((row) => row.source_name === "geopackage");
    if (postgresProfile === undefined || geopackageProfile === undefined) {
      throw new Error(`Missing environmental flood parity dataset profile for ${targetSpec.name}`);
    }

    const decodedGroupRows = decodeGroupComparisonRows(groupRows);
    const orderedGroupRows = [...decodedGroupRows].sort((left, right) =>
      buildOverlayGroupKey(left).localeCompare(buildOverlayGroupKey(right))
    );

    assertions.push(
      ...buildDatasetAssertions({
        geopackageProfile,
        postgresProfile,
        runId: args.context.runId,
        targetName: targetSpec.name,
        validatedAt,
      }),
      ...buildGroupAssertions({
        groupRows: orderedGroupRows,
        runId: args.context.runId,
        targetName: targetSpec.name,
        validatedAt,
      })
    );
    profiles.push(
      ...buildProfiles({
        geopackageProfile,
        groupRows: orderedGroupRows,
        postgresProfile,
        runId: args.context.runId,
        targetName: targetSpec.name,
        validatedAt,
      })
    );

    if ((args.failFast ?? false) && assertions.some((assertion) => !assertion.passed)) {
      break;
    }
  }

  await writeQaArtifacts({
    assertions,
    context: args.context,
    env,
    profiles,
    runner,
  });
  mergeLakeManifestArtifacts({
    artifacts: qaArtifacts,
    dataVersion: args.dataVersion,
    layout: args.context,
  });

  const failedAssertions = assertions.filter((assertion) => !assertion.passed).length;

  return {
    failedAssertions,
    passed: failedAssertions === 0,
    qaArtifacts,
    qaAssertionsPath: args.context.qaAssertionsPath,
    qaProfilePath: args.context.qaProfilePath,
    targetNames: targetSpecs.map((targetSpec) => targetSpec.name),
    validatedAt,
  };
}
