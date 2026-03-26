import { rmSync } from "node:fs";
import { join, relative } from "node:path";
import { ensureDirectory, fileExists, writeJsonAtomic, writeTextAtomic } from "./atomic-file-store";
import { ensureBatchArtifactLayout, resolveBatchArtifactLayout } from "./batch-artifact-layout";
import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import { runBufferedCommand } from "./command-runner";
import type { RunBufferedCommandResult } from "./command-runner.types";
import type {
  CountyAdjacencyBoundaryVersionRecord,
  CountyAdjacencyPublicationRecord,
  CountyAdjacencyRunContext,
  RefreshCountyAdjacencyArgs,
  RefreshCountyAdjacencyResult,
} from "./county-adjacency.types";
import { runDuckDbCli } from "./duckdb-runner";
import type { DuckDbCliOptions } from "./duckdb-runner.types";

type CountyAdjacencyDuckDbRunner = (options: DuckDbCliOptions) => Promise<RunBufferedCommandResult>;

type JsonRecord = Record<string, unknown>;

export const BOUNDARY_COUNTY_RELATION_NAME = "serve.boundary_county_geom_lod1";
export const COUNTY_ADJACENCY_MODEL_VERSION = "county-adjacency-v1";
export const COUNTY_ADJACENCY_PUBLICATION_KEY = "county_adjacency_lod1";
export const COUNTY_ADJACENCY_PUBLISHED_RELATION_NAME = "analytics.bridge_county_adjacency";

const BOUNDARY_ADJACENCY_LAYER = "county_adjacency";
const PARQUET_FILE_NAME = "part-0.parquet";
const SQL_STRING_ESCAPE_RE = /'/g;

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

function normalizeManifestRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function summarizeCommandFailure(result: RunBufferedCommandResult): string {
  const trimmedStderr = result.stderr.trim();
  if (trimmedStderr.length > 0) {
    return trimmedStderr;
  }

  const trimmedStdout = result.stdout.trim();
  if (trimmedStdout.length > 0) {
    return trimmedStdout;
  }

  return "Command produced no output";
}

function collapseSqlWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toDuckDbStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string`);
  }

  return value;
}

function readNullableString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string or null`);
  }

  return value;
}

function readRequiredNumber(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected ${key} to be a number`);
  }

  return value;
}

function buildSafeBoundarySourceDateSql(reference: string): string {
  return `CASE
    WHEN NULLIF(${reference}::text, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN NULLIF(${reference}::text, '')::date
    ELSE NULL::date
  END`;
}

function decodeCountyAdjacencyBoundaryVersionRecord(
  value: unknown
): CountyAdjacencyBoundaryVersionRecord | null {
  if (value === null) {
    return null;
  }

  if (!isJsonRecord(value)) {
    throw new Error("Expected county adjacency boundary version record");
  }

  return {
    boundaryRelationName: readRequiredString(value, "boundaryRelationName"),
    boundaryVersion: readRequiredString(value, "boundaryVersion"),
    publishedRowCount: readRequiredNumber(value, "publishedRowCount"),
    sourceAsOfDate: readNullableString(value, "sourceAsOfDate"),
    sourceRefreshedAt: readRequiredString(value, "sourceRefreshedAt"),
    sourceRelationName: readRequiredString(value, "sourceRelationName"),
    sourceRowCount: readRequiredNumber(value, "sourceRowCount"),
  };
}

function decodeCountyAdjacencyPublicationRecord(
  value: unknown
): CountyAdjacencyPublicationRecord | null {
  if (value === null) {
    return null;
  }

  if (!isJsonRecord(value)) {
    throw new Error("Expected county adjacency publication record");
  }

  return {
    artifactAbsolutePath: readNullableString(value, "artifactAbsolutePath"),
    artifactRelativePath: readNullableString(value, "artifactRelativePath"),
    boundaryVersion: readNullableString(value, "boundaryVersion"),
    publicationKey: readRequiredString(value, "publicationKey"),
    publishedAt: readNullableString(value, "publishedAt"),
    runId: readNullableString(value, "runId"),
  };
}

function runPsqlCommand(args: {
  readonly cwd: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly extraArgs: readonly string[];
}): Promise<RunBufferedCommandResult> {
  return runBufferedCommand({
    args: [args.databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", ...args.extraArgs],
    command: "psql",
    cwd: args.cwd,
    env: copyProcessEnvironment(args.env),
  });
}

async function runPsqlJsonQuery(args: {
  readonly cwd: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly sql: string;
}): Promise<unknown> {
  const result = await runPsqlCommand({
    ...args,
    extraArgs: ["-A", "-t", "-c", args.sql],
  });

  if (result.exitCode !== 0) {
    throw new Error(summarizeCommandFailure(result));
  }

  const normalized = result.stdout.trim();
  if (normalized.length === 0) {
    throw new Error("Expected JSON output from psql query");
  }

  return JSON.parse(normalized);
}

function buildBoundaryVersionLookupSql(): string {
  const boundarySourceDateSql = buildSafeBoundarySourceDateSql("county.data_version");

  return `SELECT COALESCE((
  SELECT row_to_json(boundary_publication_row)::text
  FROM (
  SELECT
    publication.relation_name AS "boundaryRelationName",
    publication.source_dataset_hash AS "boundaryVersion",
    publication.published_row_count AS "publishedRowCount",
    (
      SELECT MAX(${boundarySourceDateSql})::text
      FROM ${BOUNDARY_COUNTY_RELATION_NAME} AS county
    ) AS "sourceAsOfDate",
    to_char(
      publication.refreshed_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ) AS "sourceRefreshedAt",
    publication.source_relation_name AS "sourceRelationName",
    publication.source_row_count AS "sourceRowCount"
  FROM serve.boundary_county_publication AS publication
  WHERE publication.relation_name = ${toSqlStringLiteral(BOUNDARY_COUNTY_RELATION_NAME)}
  LIMIT 1
  ) AS boundary_publication_row
), 'null');`;
}

function buildCurrentPublicationLookupSql(): string {
  return `SELECT COALESCE((
  SELECT row_to_json(publication_row)::text
  FROM (
  SELECT
    publication.artifact_absolute_path AS "artifactAbsolutePath",
    publication.artifact_relative_path AS "artifactRelativePath",
    publication.boundary_version AS "boundaryVersion",
    publication.publication_key AS "publicationKey",
    publication.published_at::text AS "publishedAt",
    publication.run_id AS "runId"
  FROM analytics_meta.county_adjacency_publication AS publication
  WHERE publication.publication_key = ${toSqlStringLiteral(COUNTY_ADJACENCY_PUBLICATION_KEY)}
  LIMIT 1
  ) AS publication_row
), 'null');`;
}

export function resolveCountyAdjacencyRunId(boundaryVersion: string): string {
  const normalized = boundaryVersion.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("boundaryVersion must not be empty");
  }

  return `county-adjacency-${normalized}`;
}

export function resolveCountyAdjacencyRunContext(
  projectRoot: string,
  boundaryVersion: string,
  env: NodeJS.ProcessEnv = process.env
): CountyAdjacencyRunContext {
  const layout = resolveBatchArtifactLayout({
    dataset: "boundaries",
    env,
    projectRoot,
    runId: resolveCountyAdjacencyRunId(boundaryVersion),
  });
  const adjacencyArtifactDir = join(
    layout.goldPlainDir,
    `mart=${BOUNDARY_ADJACENCY_LAYER}`,
    `boundary_version=${boundaryVersion}`
  );

  return {
    ...layout,
    adjacencyArtifactDir,
    adjacencyArtifactPath: join(adjacencyArtifactDir, PARQUET_FILE_NAME),
    buildCsvPath: join(layout.runDir, "county-adjacency-build.csv"),
    buildSqlPath: join(layout.runDir, "county-adjacency-build.sql"),
    publishCsvPath: join(layout.runDir, "county-adjacency-publish.csv"),
    publishSqlPath: join(layout.runDir, "county-adjacency-publish.sql"),
    runSummaryPath: join(layout.runDir, "run-summary.json"),
  };
}

export function buildCountyAdjacencyArtifactRecord(
  context: CountyAdjacencyRunContext
): LakeManifestArtifactRecord {
  return {
    format: "parquet",
    layer: BOUNDARY_ADJACENCY_LAYER,
    partitionKeys: ["boundary_version"],
    phase: "gold-plain",
    relativePath: normalizeManifestRelativePath(
      relative(context.runDir, context.adjacencyArtifactDir)
    ),
  };
}

export function buildCountyAdjacencyExportSql(args: {
  readonly boundary: CountyAdjacencyBoundaryVersionRecord;
  readonly runId: string;
}): string {
  const boundarySourceDateSql = buildSafeBoundarySourceDateSql("county.data_version");
  const fallbackPublicationDateSql = `${toSqlStringLiteral(args.boundary.sourceRefreshedAt)}::timestamptz::date`;
  const sourceAsOfDateSql =
    args.boundary.sourceAsOfDate === null
      ? "NULL::date"
      : `${toSqlStringLiteral(args.boundary.sourceAsOfDate)}::date`;
  const resolvedEffectiveDateSql = `COALESCE(
    (SELECT MAX(source_as_of_date) FROM boundary_source),
    ${sourceAsOfDateSql},
    ${fallbackPublicationDateSql}
  )`;

  return `WITH boundary_source AS (
  SELECT
    county.county_fips AS county_geoid,
    county.geom,
    county.geom_3857,
    ${boundarySourceDateSql} AS source_as_of_date
  FROM ${args.boundary.boundaryRelationName} AS county
),
adjacency_pairs AS (
  SELECT
    county.county_geoid,
    adjacent.county_geoid AS adjacent_county_geoid,
    ROUND(
      COALESCE(
        ST_Length(
          ST_CollectionExtract(
            ST_Intersection(county.geom_3857, adjacent.geom_3857),
            2
          )
        ),
        0
      )::numeric,
      2
    ) AS shared_boundary_meters,
    COALESCE(
      ST_Dimension(ST_Intersection(county.geom, adjacent.geom)) = 0,
      false
    ) AS point_touch
  FROM boundary_source AS county
  INNER JOIN boundary_source AS adjacent
    ON county.county_geoid < adjacent.county_geoid
   AND ST_Touches(county.geom, adjacent.geom)
),
directed_edges AS (
  SELECT
    pair.county_geoid,
    pair.adjacent_county_geoid,
    pair.shared_boundary_meters,
    pair.point_touch
  FROM adjacency_pairs AS pair
  UNION ALL
  SELECT
    pair.adjacent_county_geoid AS county_geoid,
    pair.county_geoid AS adjacent_county_geoid,
    pair.shared_boundary_meters,
    pair.point_touch
  FROM adjacency_pairs AS pair
)
SELECT
  edge.county_geoid,
  edge.adjacent_county_geoid,
  edge.shared_boundary_meters,
  edge.point_touch,
  ${toSqlStringLiteral(args.boundary.boundaryVersion)}::text AS boundary_version,
  ${toSqlStringLiteral(args.runId)}::text AS run_id,
  ${resolvedEffectiveDateSql} AS data_version,
  ${resolvedEffectiveDateSql} AS effective_date,
  COALESCE(
    (SELECT MAX(source_as_of_date) FROM boundary_source),
    ${sourceAsOfDateSql}
  ) AS source_as_of_date,
  ${toSqlStringLiteral(COUNTY_ADJACENCY_MODEL_VERSION)}::text AS model_version,
  ${toSqlStringLiteral(args.boundary.sourceRefreshedAt)}::timestamptz AS source_pull_ts
FROM directed_edges AS edge
ORDER BY edge.county_geoid, edge.adjacent_county_geoid`;
}

function buildCountyAdjacencyExportCopySql(args: {
  readonly boundary: CountyAdjacencyBoundaryVersionRecord;
  readonly csvPath: string;
  readonly runId: string;
}): string {
  return `\\copy (${collapseSqlWhitespace(buildCountyAdjacencyExportSql(args))}) TO ${toSqlStringLiteral(args.csvPath)} WITH (FORMAT csv, HEADER true)`;
}

function buildCountyAdjacencyParquetSql(args: {
  readonly artifactPath: string;
  readonly csvPath: string;
}): string {
  return `PRAGMA disable_progress_bar;

COPY (
  SELECT *
  FROM read_csv_auto(${toDuckDbStringLiteral(args.csvPath)}, HEADER = true, SAMPLE_SIZE = -1)
) TO ${toDuckDbStringLiteral(args.artifactPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`;
}

function buildCountyAdjacencyPublishProjectionSql(args: {
  readonly artifactPath: string;
  readonly csvPath: string;
}): string {
  return `PRAGMA disable_progress_bar;

COPY (
  SELECT
    county_geoid,
    adjacent_county_geoid,
    shared_boundary_meters,
    point_touch,
    source_pull_ts,
    source_as_of_date,
    effective_date,
    model_version
  FROM read_parquet(${toDuckDbStringLiteral(args.artifactPath)})
  ORDER BY county_geoid, adjacent_county_geoid
) TO ${toDuckDbStringLiteral(args.csvPath)} (
  FORMAT CSV,
  HEADER
);`;
}

function buildCountyAdjacencyPublishSql(args: {
  readonly artifact: LakeManifestArtifactRecord;
  readonly boundary: CountyAdjacencyBoundaryVersionRecord;
  readonly context: CountyAdjacencyRunContext;
}): string {
  const sourceAsOfDateSql =
    args.boundary.sourceAsOfDate === null
      ? "NULL::date"
      : `${toSqlStringLiteral(args.boundary.sourceAsOfDate)}::date`;

  const copyColumns = [
    "county_geoid",
    "adjacent_county_geoid",
    "shared_boundary_meters",
    "point_touch",
    "source_pull_ts",
    "source_as_of_date",
    "effective_date",
    "model_version",
  ].join(", ");

  return `BEGIN;

TRUNCATE TABLE ${COUNTY_ADJACENCY_PUBLISHED_RELATION_NAME};

\\copy ${COUNTY_ADJACENCY_PUBLISHED_RELATION_NAME} (${copyColumns}) FROM ${toSqlStringLiteral(args.context.publishCsvPath)} WITH (FORMAT csv, HEADER true);

ANALYZE ${COUNTY_ADJACENCY_PUBLISHED_RELATION_NAME};

INSERT INTO analytics_meta.county_adjacency_publication (
  publication_key,
  published_relation_name,
  boundary_relation_name,
  source_relation_name,
  boundary_version,
  source_row_count,
  published_row_count,
  source_refreshed_at,
  source_as_of_date,
  artifact_relative_path,
  artifact_absolute_path,
  run_id,
  model_version,
  built_at,
  published_at,
  notes
)
VALUES (
  ${toSqlStringLiteral(COUNTY_ADJACENCY_PUBLICATION_KEY)},
  ${toSqlStringLiteral(COUNTY_ADJACENCY_PUBLISHED_RELATION_NAME)},
  ${toSqlStringLiteral(args.boundary.boundaryRelationName)},
  ${toSqlStringLiteral(args.boundary.sourceRelationName)},
  ${toSqlStringLiteral(args.boundary.boundaryVersion)},
  ${String(args.boundary.sourceRowCount)},
  (SELECT COUNT(*)::integer FROM ${COUNTY_ADJACENCY_PUBLISHED_RELATION_NAME}),
  ${toSqlStringLiteral(args.boundary.sourceRefreshedAt)}::timestamptz,
  ${sourceAsOfDateSql},
  ${toSqlStringLiteral(args.artifact.relativePath)},
  ${toSqlStringLiteral(args.context.adjacencyArtifactPath)},
  ${toSqlStringLiteral(args.context.runId)},
  ${toSqlStringLiteral(COUNTY_ADJACENCY_MODEL_VERSION)},
  now(),
  now(),
  jsonb_build_object(
    'artifactFormat',
    'parquet',
    'partitionKeys',
    to_jsonb(ARRAY['boundary_version']),
    'sharedBoundaryField',
    'shared_boundary_meters',
    'pointTouchField',
    'point_touch'
  )
)
ON CONFLICT (publication_key) DO UPDATE
SET
  published_relation_name = EXCLUDED.published_relation_name,
  boundary_relation_name = EXCLUDED.boundary_relation_name,
  source_relation_name = EXCLUDED.source_relation_name,
  boundary_version = EXCLUDED.boundary_version,
  source_row_count = EXCLUDED.source_row_count,
  published_row_count = EXCLUDED.published_row_count,
  source_refreshed_at = EXCLUDED.source_refreshed_at,
  source_as_of_date = EXCLUDED.source_as_of_date,
  artifact_relative_path = EXCLUDED.artifact_relative_path,
  artifact_absolute_path = EXCLUDED.artifact_absolute_path,
  run_id = EXCLUDED.run_id,
  model_version = EXCLUDED.model_version,
  built_at = EXCLUDED.built_at,
  published_at = EXCLUDED.published_at,
  notes = EXCLUDED.notes;

ANALYZE analytics_meta.county_adjacency_publication;

COMMIT;
`;
}

async function readBoundaryVersionRecord(args: {
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly projectRoot: string;
}): Promise<CountyAdjacencyBoundaryVersionRecord> {
  const record = decodeCountyAdjacencyBoundaryVersionRecord(
    await runPsqlJsonQuery({
      cwd: args.projectRoot,
      databaseUrl: args.databaseUrl,
      env: args.env,
      sql: buildBoundaryVersionLookupSql(),
    })
  );

  if (record === null) {
    throw new Error(
      `Boundary publication row not found for ${BOUNDARY_COUNTY_RELATION_NAME}. Run scripts/sql/refresh-county-boundaries.sql first.`
    );
  }

  return record;
}

async function readCurrentPublication(args: {
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly projectRoot: string;
}): Promise<CountyAdjacencyPublicationRecord | null> {
  return decodeCountyAdjacencyPublicationRecord(
    await runPsqlJsonQuery({
      cwd: args.projectRoot,
      databaseUrl: args.databaseUrl,
      env: args.env,
      sql: buildCurrentPublicationLookupSql(),
    })
  );
}

async function ensureAdjacencyArtifact(args: {
  readonly boundary: CountyAdjacencyBoundaryVersionRecord;
  readonly context: CountyAdjacencyRunContext;
  readonly databaseUrl: string;
  readonly duckDbRunner: CountyAdjacencyDuckDbRunner;
  readonly env: NodeJS.ProcessEnv;
  readonly forceRebuild: boolean;
  readonly projectRoot: string;
}): Promise<boolean> {
  if (!args.forceRebuild && fileExists(args.context.adjacencyArtifactPath)) {
    return false;
  }

  rmSync(args.context.adjacencyArtifactDir, {
    force: true,
    recursive: true,
  });
  rmSync(args.context.buildCsvPath, { force: true });
  rmSync(args.context.buildSqlPath, { force: true });
  ensureDirectory(args.context.adjacencyArtifactDir);

  writeTextAtomic(
    args.context.buildSqlPath,
    `${buildCountyAdjacencyExportCopySql({
      boundary: args.boundary,
      csvPath: args.context.buildCsvPath,
      runId: args.context.runId,
    })}\n`
  );

  try {
    const exportResult = await runPsqlCommand({
      cwd: args.projectRoot,
      databaseUrl: args.databaseUrl,
      env: args.env,
      extraArgs: ["-f", args.context.buildSqlPath],
    });

    if (exportResult.exitCode !== 0) {
      throw new Error(`county adjacency export failed: ${summarizeCommandFailure(exportResult)}`);
    }

    if (!fileExists(args.context.buildCsvPath)) {
      throw new Error(`county adjacency export did not produce ${args.context.buildCsvPath}`);
    }

    const duckDbResult = await args.duckDbRunner({
      bootstrapPath: args.context.runDuckDbBootstrapPath,
      cwd: args.context.runDir,
      databasePath: args.context.runDuckDbPath,
      sql: buildCountyAdjacencyParquetSql({
        artifactPath: args.context.adjacencyArtifactPath,
        csvPath: args.context.buildCsvPath,
      }),
    });

    if (duckDbResult.exitCode !== 0) {
      throw new Error(
        `county adjacency parquet write failed: ${summarizeCommandFailure(duckDbResult)}`
      );
    }

    if (!fileExists(args.context.adjacencyArtifactPath)) {
      throw new Error(`county adjacency artifact missing: ${args.context.adjacencyArtifactPath}`);
    }

    return true;
  } finally {
    rmSync(args.context.buildCsvPath, { force: true });
    rmSync(args.context.buildSqlPath, { force: true });
  }
}

async function publishAdjacencyArtifact(args: {
  readonly artifact: LakeManifestArtifactRecord;
  readonly boundary: CountyAdjacencyBoundaryVersionRecord;
  readonly context: CountyAdjacencyRunContext;
  readonly databaseUrl: string;
  readonly duckDbRunner: CountyAdjacencyDuckDbRunner;
  readonly env: NodeJS.ProcessEnv;
  readonly projectRoot: string;
}): Promise<void> {
  rmSync(args.context.publishCsvPath, { force: true });
  rmSync(args.context.publishSqlPath, { force: true });

  const duckDbResult = await args.duckDbRunner({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    sql: buildCountyAdjacencyPublishProjectionSql({
      artifactPath: args.context.adjacencyArtifactPath,
      csvPath: args.context.publishCsvPath,
    }),
  });

  if (duckDbResult.exitCode !== 0) {
    throw new Error(
      `county adjacency publish projection failed: ${summarizeCommandFailure(duckDbResult)}`
    );
  }

  if (!fileExists(args.context.publishCsvPath)) {
    throw new Error(`county adjacency publish CSV missing: ${args.context.publishCsvPath}`);
  }

  writeTextAtomic(
    args.context.publishSqlPath,
    `${buildCountyAdjacencyPublishSql({
      artifact: args.artifact,
      boundary: args.boundary,
      context: args.context,
    })}\n`
  );

  try {
    const publishResult = await runPsqlCommand({
      cwd: args.projectRoot,
      databaseUrl: args.databaseUrl,
      env: args.env,
      extraArgs: ["-f", args.context.publishSqlPath],
    });

    if (publishResult.exitCode !== 0) {
      throw new Error(`county adjacency publish failed: ${summarizeCommandFailure(publishResult)}`);
    }
  } finally {
    rmSync(args.context.publishCsvPath, { force: true });
    rmSync(args.context.publishSqlPath, { force: true });
  }
}

export async function refreshCountyAdjacency(
  args: RefreshCountyAdjacencyArgs
): Promise<RefreshCountyAdjacencyResult> {
  const env = args.env ?? process.env;
  const databaseUrl = resolveDatabaseUrl(env);
  const boundary = await readBoundaryVersionRecord({
    databaseUrl,
    env,
    projectRoot: args.projectRoot,
  });
  const context = resolveCountyAdjacencyRunContext(args.projectRoot, boundary.boundaryVersion, env);
  const artifact = buildCountyAdjacencyArtifactRecord(context);
  const manifestDate = boundary.sourceAsOfDate ?? boundary.sourceRefreshedAt.slice(0, 10);

  ensureBatchArtifactLayout({
    dataVersion: manifestDate,
    effectiveDate: manifestDate,
    layout: context,
  });
  const currentPublication = await readCurrentPublication({
    databaseUrl,
    env,
    projectRoot: args.projectRoot,
  });
  const publishedToPostgres = currentPublication?.boundaryVersion !== boundary.boundaryVersion;

  const builtArtifact = await ensureAdjacencyArtifact({
    boundary,
    context,
    databaseUrl,
    duckDbRunner: runDuckDbCli,
    env,
    forceRebuild: publishedToPostgres,
    projectRoot: args.projectRoot,
  });

  ensureBatchArtifactLayout({
    artifacts: [artifact],
    dataVersion: manifestDate,
    effectiveDate: manifestDate,
    layout: context,
  });

  if (publishedToPostgres) {
    await publishAdjacencyArtifact({
      artifact,
      boundary,
      context,
      databaseUrl,
      duckDbRunner: runDuckDbCli,
      env,
      projectRoot: args.projectRoot,
    });
  }

  const result: RefreshCountyAdjacencyResult = {
    artifactPath: context.adjacencyArtifactPath,
    boundaryVersion: boundary.boundaryVersion,
    builtArtifact,
    publishedToPostgres,
    runId: context.runId,
    skippedPublishReason: publishedToPostgres ? null : "boundary_version_unchanged",
  };

  writeJsonAtomic(context.runSummaryPath, {
    ...result,
    artifactRelativePath: artifact.relativePath,
    modelVersion: COUNTY_ADJACENCY_MODEL_VERSION,
    sourceAsOfDate: boundary.sourceAsOfDate,
    sourceRefreshedAt: boundary.sourceRefreshedAt,
    sourceRelationName: boundary.sourceRelationName,
  });

  return result;
}
