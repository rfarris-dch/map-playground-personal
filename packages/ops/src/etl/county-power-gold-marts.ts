import { readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ensureDirectory, fileExists } from "./atomic-file-store";
import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import { runBufferedCommand } from "./command-runner";
import type { RunBufferedCommandResult } from "./command-runner.types";
import type {
  CountyPowerDuckDbRunner,
  CountyPowerGoldMartName,
  CountyPowerGoldMartSpec,
  CountyPowerGoldMirrorExporter,
  CountyPowerGoldWriteArgs,
} from "./county-power-gold-marts.types";
import type { CountyPowerBundleManifest, CountyPowerRunContext } from "./county-power-sync.types";
import { writeDuckDbBootstrapSql } from "./duckdb-bootstrap";
import { runDuckDbCli } from "./duckdb-runner";

const PARQUET_FILE_NAME = "part-0.parquet";
const PSQL_COPY_ROW_COUNT_RE = /COPY\s+(\d+)/;
const SQL_STRING_ESCAPE_RE = /'/g;
const COUNTY_POWER_GOLD_MART_NAMES: readonly CountyPowerGoldMartName[] = [
  "county_score_snapshot",
  "publication_summary",
  "coverage_fields",
  "coverage_by_operator",
  "resolution_by_source",
  "qa_operator_zone",
  "qa_congestion",
];

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

function toDuckDbStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function toSqlStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function collapseSqlWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function directoryContainsParquetFiles(path: string): boolean {
  if (!fileExists(path)) {
    return false;
  }

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory() && directoryContainsParquetFiles(entryPath)) {
      return true;
    }
    if (entry.isFile() && entry.name.endsWith(".parquet")) {
      return true;
    }
  }

  return false;
}

function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const connectionString = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof connectionString === "string" && connectionString.trim().length > 0) {
    return connectionString.trim();
  }

  throw new Error("Missing DATABASE_URL or POSTGRES_URL");
}

function buildGoldMartPath(context: CountyPowerRunContext, name: CountyPowerGoldMartName): string {
  return join(context.runDir, `${name}.csv`);
}

function buildGoldArtifactRecord(args: {
  readonly context: CountyPowerRunContext;
  readonly name: CountyPowerGoldMartName;
  readonly publicationRunId: string;
}): CountyPowerGoldMartSpec {
  const outputRootPath = join(
    args.context.goldPlainDir,
    `mart=${args.name}`,
    `publication_run_id=${args.publicationRunId}`
  );
  const csvPath =
    args.name === "county_score_snapshot" || args.name === "publication_summary"
      ? buildGoldMartPath(args.context, args.name)
      : null;

  return {
    artifact: {
      format: "parquet",
      layer: args.name,
      partitionKeys: ["publication_run_id"],
      phase: "gold-plain",
      relativePath: normalizeManifestRelativePath(relative(args.context.runDir, outputRootPath)),
    },
    csvPath,
    name: args.name,
    outputFilePath: join(outputRootPath, PARQUET_FILE_NAME),
    outputRootPath,
  };
}

export function buildCountyPowerGoldMartSpecs(args: {
  readonly context: CountyPowerRunContext;
  readonly publicationRunId: string;
}): readonly CountyPowerGoldMartSpec[] {
  return COUNTY_POWER_GOLD_MART_NAMES.map((name) =>
    buildGoldArtifactRecord({
      context: args.context,
      name,
      publicationRunId: args.publicationRunId,
    })
  );
}

function resolveSilverInputGlob(args: {
  readonly context: CountyPowerRunContext;
  readonly manifest: CountyPowerBundleManifest;
  readonly datasetKey: keyof CountyPowerBundleManifest["datasets"];
}): string {
  const sourcePath = resolve(
    dirname(args.context.normalizedManifestPath),
    args.manifest.datasets[args.datasetKey].path
  );

  return sourcePath.endsWith(".parquet") ? sourcePath : join(sourcePath, "**", "*.parquet");
}

function buildPostgresSnapshotMirrorQuery(publicationRunId: string): string {
  return `SELECT *
FROM analytics.fact_market_analysis_score_snapshot
WHERE publication_run_id = ${toSqlStringLiteral(publicationRunId)}
ORDER BY county_geoid`;
}

function buildPostgresPublicationMirrorQuery(publicationRunId: string): string {
  return `SELECT *
FROM analytics.fact_publication
WHERE publication_run_id = ${toSqlStringLiteral(publicationRunId)}
ORDER BY publication_run_id`;
}

function runPsqlCopyCommand(args: {
  readonly csvPath: string;
  readonly cwd: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly query: string;
}): Promise<RunBufferedCommandResult> {
  return runBufferedCommand({
    args: [
      args.databaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `\\copy (${collapseSqlWhitespace(args.query)}) TO ${toSqlStringLiteral(args.csvPath)} WITH (FORMAT csv, HEADER true)`,
    ],
    command: "psql",
    cwd: args.cwd,
    env: copyProcessEnvironment(args.env),
  });
}

function readCopiedRowCount(result: RunBufferedCommandResult): number | null {
  const match = result.stdout.match(PSQL_COPY_ROW_COUNT_RE);
  if (match?.[1] === undefined) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

async function exportCountyPowerGoldMirrorCsv(args: {
  readonly context: CountyPowerRunContext;
  readonly csvPath: string;
  readonly databaseUrl: string;
  readonly env: NodeJS.ProcessEnv;
  readonly publicationRunId: string;
  readonly query: string;
}): Promise<void> {
  const result = await runPsqlCopyCommand({
    csvPath: args.csvPath,
    cwd: args.context.runDir,
    databaseUrl: args.databaseUrl,
    env: args.env,
    query: args.query,
  });

  if (result.exitCode !== 0) {
    throw new Error(`county power gold export failed: ${summarizeCommandFailure(result)}`);
  }

  const copiedRowCount = readCopiedRowCount(result);
  if (copiedRowCount === null || copiedRowCount === 0) {
    throw new Error(
      `county power gold export produced no rows for publication_run_id=${args.publicationRunId}`
    );
  }
  if (!fileExists(args.csvPath)) {
    throw new Error(`county power gold export missing CSV: ${args.csvPath}`);
  }
}

function buildCountyPowerGoldDuckDbSql(args: {
  readonly context: CountyPowerRunContext;
  readonly manifest: CountyPowerBundleManifest;
  readonly publicationRunId: string;
  readonly specs: readonly CountyPowerGoldMartSpec[];
}): string {
  const countyScoreSnapshotSpec = args.specs.find((spec) => spec.name === "county_score_snapshot");
  const publicationSummarySpec = args.specs.find((spec) => spec.name === "publication_summary");
  const coverageFieldsSpec = args.specs.find((spec) => spec.name === "coverage_fields");
  const coverageByOperatorSpec = args.specs.find((spec) => spec.name === "coverage_by_operator");
  const resolutionBySourceSpec = args.specs.find((spec) => spec.name === "resolution_by_source");
  const qaOperatorZoneSpec = args.specs.find((spec) => spec.name === "qa_operator_zone");
  const qaCongestionSpec = args.specs.find((spec) => spec.name === "qa_congestion");

  if (
    countyScoreSnapshotSpec === undefined ||
    publicationSummarySpec === undefined ||
    coverageFieldsSpec === undefined ||
    coverageByOperatorSpec === undefined ||
    resolutionBySourceSpec === undefined ||
    qaOperatorZoneSpec === undefined ||
    qaCongestionSpec === undefined ||
    countyScoreSnapshotSpec.csvPath === null ||
    publicationSummarySpec.csvPath === null
  ) {
    throw new Error("Missing county power gold mart spec");
  }

  const queueProjectsGlob = resolveSilverInputGlob({
    context: args.context,
    datasetKey: "queueProjects",
    manifest: args.manifest,
  });
  const queueResolutionsGlob = resolveSilverInputGlob({
    context: args.context,
    datasetKey: "queueCountyResolutions",
    manifest: args.manifest,
  });
  const queueSnapshotsGlob = resolveSilverInputGlob({
    context: args.context,
    datasetKey: "queueSnapshots",
    manifest: args.manifest,
  });
  const queueUnresolvedGlob = resolveSilverInputGlob({
    context: args.context,
    datasetKey: "queueUnresolved",
    manifest: args.manifest,
  });
  const countyOperatorZonesGlob = resolveSilverInputGlob({
    context: args.context,
    datasetKey: "countyOperatorZones",
    manifest: args.manifest,
  });
  const congestionGlob = resolveSilverInputGlob({
    context: args.context,
    datasetKey: "congestion",
    manifest: args.manifest,
  });

  return `PRAGMA disable_progress_bar;
INSTALL json;
LOAD json;

CREATE OR REPLACE TEMP VIEW county_score_snapshot_source AS
SELECT *
FROM read_csv_auto(
  ${toDuckDbStringLiteral(countyScoreSnapshotSpec.csvPath)},
  HEADER = true,
  SAMPLE_SIZE = -1
);

CREATE OR REPLACE TEMP VIEW publication_summary_source AS
SELECT *
FROM read_csv_auto(
  ${toDuckDbStringLiteral(publicationSummarySpec.csvPath)},
  HEADER = true,
  SAMPLE_SIZE = -1
);

CREATE OR REPLACE TEMP VIEW queue_projects_source AS
SELECT *
FROM read_parquet(${toDuckDbStringLiteral(queueProjectsGlob)}, hive_partitioning = true);

CREATE OR REPLACE TEMP VIEW queue_resolutions_source AS
SELECT *
FROM read_parquet(${toDuckDbStringLiteral(queueResolutionsGlob)}, hive_partitioning = true);

CREATE OR REPLACE TEMP VIEW queue_snapshots_source AS
SELECT *
FROM read_parquet(${toDuckDbStringLiteral(queueSnapshotsGlob)}, hive_partitioning = true);

CREATE OR REPLACE TEMP VIEW queue_unresolved_source AS
SELECT *
FROM read_parquet(${toDuckDbStringLiteral(queueUnresolvedGlob)}, hive_partitioning = true);

CREATE OR REPLACE TEMP VIEW county_operator_zones_source AS
SELECT *
FROM read_parquet(${toDuckDbStringLiteral(countyOperatorZonesGlob)}, hive_partitioning = true);

CREATE OR REPLACE TEMP VIEW congestion_source AS
SELECT *
FROM read_parquet(${toDuckDbStringLiteral(congestionGlob)}, hive_partitioning = true);

COPY (
  SELECT *
  FROM county_score_snapshot_source
  ORDER BY county_geoid
) TO ${toDuckDbStringLiteral(countyScoreSnapshotSpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  SELECT *
  FROM publication_summary_source
  ORDER BY publication_run_id
) TO ${toDuckDbStringLiteral(publicationSummarySpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  WITH current_scores AS (
    SELECT *
    FROM county_score_snapshot_source
  ),
  field_coverage AS (
    SELECT
      'wholesaleOperator' AS field_name,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(wholesale_operator), '') IS NOT NULL) AS populated_count,
      COUNT(*) AS total_count
    FROM current_scores
    UNION ALL
    SELECT
      'balancingAuthority',
      COUNT(*) FILTER (WHERE NULLIF(TRIM(balancing_authority), '') IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'primaryTduOrUtility',
      COUNT(*) FILTER (WHERE NULLIF(TRIM(primary_tdu_or_utility), '') IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'operatorZoneLabel',
      COUNT(*) FILTER (WHERE NULLIF(TRIM(operator_zone_label), '') IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'operatorWeatherZone',
      COUNT(*) FILTER (WHERE NULLIF(TRIM(operator_weather_zone), '') IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'meteoZone',
      COUNT(*) FILTER (WHERE NULLIF(TRIM(meteo_zone), '') IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'avgRtCongestionComponent',
      COUNT(*) FILTER (WHERE avg_rt_congestion_component IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'p95ShadowPrice',
      COUNT(*) FILTER (WHERE p95_shadow_price IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'queueProjectCountActive',
      COUNT(*) FILTER (WHERE queue_project_count_active IS NOT NULL),
      COUNT(*)
    FROM current_scores
    UNION ALL
    SELECT
      'queueMwActive',
      COUNT(*) FILTER (WHERE queue_mw_active IS NOT NULL),
      COUNT(*)
    FROM current_scores
  )
  SELECT
    field_name,
    populated_count,
    total_count
  FROM field_coverage
  ORDER BY field_name
) TO ${toDuckDbStringLiteral(coverageFieldsSpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  SELECT
    COALESCE(NULLIF(TRIM(wholesale_operator), ''), 'unknown') AS wholesale_operator,
    COUNT(*) AS county_count,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(operator_zone_label), '') IS NOT NULL)
      AS operator_zone_label_count,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(operator_weather_zone), '') IS NOT NULL)
      AS operator_weather_zone_count,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(meteo_zone), '') IS NOT NULL)
      AS meteo_zone_count,
    COUNT(*) FILTER (WHERE avg_rt_congestion_component IS NOT NULL)
      AS avg_rt_congestion_component_count,
    COUNT(*) FILTER (WHERE p95_shadow_price IS NOT NULL) AS p95_shadow_price_count,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(primary_tdu_or_utility), '') IS NOT NULL)
      AS primary_tdu_or_utility_count
  FROM county_score_snapshot_source
  GROUP BY COALESCE(NULLIF(TRIM(wholesale_operator), ''), 'unknown')
  ORDER BY COALESCE(NULLIF(TRIM(wholesale_operator), ''), 'unknown')
) TO ${toDuckDbStringLiteral(coverageByOperatorSpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  WITH latest_projects AS (
    SELECT *
    FROM queue_projects_source
  ),
  latest_resolutions AS (
    SELECT *
    FROM queue_resolutions_source
  ),
  latest_unresolved AS (
    SELECT *
    FROM queue_unresolved_source
  ),
  latest_snapshots AS (
    SELECT *
    FROM queue_snapshots_source
  ),
  project_totals AS (
    SELECT sourceSystem AS source_system, COUNT(*) AS total_projects
    FROM latest_projects
    GROUP BY sourceSystem
  ),
  snapshot_totals AS (
    SELECT sourceSystem AS source_system, COUNT(*) AS total_snapshots
    FROM latest_snapshots
    GROUP BY sourceSystem
  ),
  resolution_totals AS (
    SELECT
      sourceSystem AS source_system,
      COUNT(*) FILTER (WHERE resolverType = 'manual_override') AS manual_resolution_count,
      COUNT(*) FILTER (
        WHERE resolverType IN ('explicit_county', 'explicit_multi_county')
      ) AS direct_resolution_count,
      COUNT(*) FILTER (
        WHERE resolverType NOT IN ('manual_override', 'explicit_county', 'explicit_multi_county')
      ) AS derived_resolution_count,
      COUNT(*) FILTER (WHERE resolverConfidence = 'low') AS low_confidence_resolution_count
    FROM latest_resolutions
    GROUP BY sourceSystem
  ),
  unresolved_projects AS (
    SELECT sourceSystem AS source_system, COUNT(*) AS unresolved_projects
    FROM latest_unresolved
    GROUP BY sourceSystem
  ),
  unresolved_snapshots AS (
    SELECT snapshot.sourceSystem AS source_system, COUNT(*) AS unresolved_snapshots
    FROM latest_snapshots AS snapshot
    LEFT JOIN latest_resolutions AS resolution
      ON resolution.projectId = snapshot.projectId
      AND resolution.sourceSystem = snapshot.sourceSystem
    WHERE snapshot.countyFips IS NULL
      AND resolution.projectId IS NULL
    GROUP BY snapshot.sourceSystem
  ),
  unresolved_project_samples AS (
    SELECT
      unresolved.sourceSystem AS source_system,
      unresolved.projectId,
      NULLIF(TRIM(unresolved.queuePoiLabel), '') AS queue_poi_label,
      NULLIF(TRIM(unresolved.rawLocationLabel), '') AS source_location_label,
      ROW_NUMBER() OVER (
        PARTITION BY unresolved.sourceSystem
        ORDER BY unresolved.projectId
      ) AS sample_rank
    FROM latest_unresolved AS unresolved
  ),
  sample_labels AS (
    SELECT
      source_system,
      CAST(
        COALESCE(
          TO_JSON(
            LIST(queue_poi_label) FILTER (
              WHERE sample_rank <= 5
                AND queue_poi_label IS NOT NULL
            )
          ),
          '[]'
        ) AS VARCHAR
      ) AS sample_poi_labels,
      CAST(
        COALESCE(
          TO_JSON(
            LIST(source_location_label) FILTER (
              WHERE sample_rank <= 5
                AND source_location_label IS NOT NULL
            )
          ),
          '[]'
        ) AS VARCHAR
      ) AS sample_location_labels
    FROM unresolved_project_samples
    GROUP BY source_system
  ),
  unresolved_snapshot_samples AS (
    SELECT
      snapshot.sourceSystem AS source_system,
      snapshot.projectId,
      NULLIF(TRIM(project.queuePoiLabel), '') AS queue_poi_label,
      NULLIF(TRIM(project.queueName), '') AS source_location_label,
      ROW_NUMBER() OVER (
        PARTITION BY snapshot.sourceSystem
        ORDER BY snapshot.projectId
      ) AS sample_rank
    FROM latest_snapshots AS snapshot
    LEFT JOIN latest_projects AS project
      ON project.projectId = snapshot.projectId
      AND project.sourceSystem = snapshot.sourceSystem
    LEFT JOIN latest_resolutions AS resolution
      ON resolution.projectId = snapshot.projectId
      AND resolution.sourceSystem = snapshot.sourceSystem
    WHERE snapshot.countyFips IS NULL
      AND resolution.projectId IS NULL
  ),
  sample_snapshot_labels AS (
    SELECT
      source_system,
      CAST(
        COALESCE(
          TO_JSON(
            LIST(queue_poi_label) FILTER (
              WHERE sample_rank <= 5
                AND queue_poi_label IS NOT NULL
            )
          ),
          '[]'
        ) AS VARCHAR
      ) AS sample_snapshot_poi_labels,
      CAST(
        COALESCE(
          TO_JSON(
            LIST(source_location_label) FILTER (
              WHERE sample_rank <= 5
                AND source_location_label IS NOT NULL
            )
          ),
          '[]'
        ) AS VARCHAR
      ) AS sample_snapshot_location_labels
    FROM unresolved_snapshot_samples
    GROUP BY source_system
  ),
  source_systems AS (
    SELECT source_system FROM project_totals
    UNION
    SELECT source_system FROM snapshot_totals
    UNION
    SELECT source_system FROM resolution_totals
    UNION
    SELECT source_system FROM unresolved_projects
    UNION
    SELECT source_system FROM unresolved_snapshots
    UNION
    SELECT sourceSystem AS source_system FROM latest_unresolved
  )
  SELECT
    source_systems.source_system,
    COALESCE(project_totals.total_projects, 0) AS total_projects,
    COALESCE(unresolved_projects.unresolved_projects, 0) AS unresolved_projects,
    COALESCE(snapshot_totals.total_snapshots, 0) AS total_snapshots,
    COALESCE(unresolved_snapshots.unresolved_snapshots, 0) AS unresolved_snapshots,
    COALESCE(resolution_totals.direct_resolution_count, 0) AS direct_resolution_count,
    COALESCE(resolution_totals.derived_resolution_count, 0) AS derived_resolution_count,
    COALESCE(resolution_totals.manual_resolution_count, 0) AS manual_resolution_count,
    COALESCE(resolution_totals.low_confidence_resolution_count, 0)
      AS low_confidence_resolution_count,
    COALESCE(sample_labels.sample_poi_labels, '[]') AS sample_poi_labels,
    COALESCE(sample_labels.sample_location_labels, '[]') AS sample_location_labels,
    COALESCE(sample_snapshot_labels.sample_snapshot_poi_labels, '[]')
      AS sample_snapshot_poi_labels,
    COALESCE(sample_snapshot_labels.sample_snapshot_location_labels, '[]')
      AS sample_snapshot_location_labels,
    CAST(${toDuckDbStringLiteral(args.manifest.effectiveDate)} AS DATE) AS effective_date
  FROM source_systems
  LEFT JOIN project_totals
    ON project_totals.source_system = source_systems.source_system
  LEFT JOIN unresolved_projects
    ON unresolved_projects.source_system = source_systems.source_system
  LEFT JOIN snapshot_totals
    ON snapshot_totals.source_system = source_systems.source_system
  LEFT JOIN unresolved_snapshots
    ON unresolved_snapshots.source_system = source_systems.source_system
  LEFT JOIN resolution_totals
    ON resolution_totals.source_system = source_systems.source_system
  LEFT JOIN sample_labels
    ON sample_labels.source_system = source_systems.source_system
  LEFT JOIN sample_snapshot_labels
    ON sample_snapshot_labels.source_system = source_systems.source_system
  ORDER BY source_systems.source_system
) TO ${toDuckDbStringLiteral(resolutionBySourceSpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  SELECT
    countyFips AS county_fips,
    operator AS wholesale_operator,
    operatorZoneLabel AS operator_zone_label,
    operatorZoneType AS operator_zone_type,
    operatorZoneConfidence AS operator_zone_confidence,
    resolutionMethod AS resolution_method,
    allocationShare AS allocation_share,
    CAST(${toDuckDbStringLiteral(args.manifest.datasets.countyOperatorZones.sourceAsOfDate)} AS DATE)
      AS source_as_of_date
  FROM county_operator_zones_source
  ORDER BY county_fips, wholesale_operator, operator_zone_label
) TO ${toDuckDbStringLiteral(qaOperatorZoneSpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);

COPY (
  SELECT
    countyFips AS county_fips,
    avgRtCongestionComponent AS avg_rt_congestion_component,
    p95ShadowPrice AS p95_shadow_price,
    negativePriceHourShare AS negative_price_hour_share,
    CAST(${toDuckDbStringLiteral(args.manifest.datasets.congestion.sourceAsOfDate)} AS DATE)
      AS source_as_of_date
  FROM congestion_source
  ORDER BY county_fips
) TO ${toDuckDbStringLiteral(qaCongestionSpec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`;
}

export async function writeCountyPowerGoldMartFiles(
  args: CountyPowerGoldWriteArgs & {
    readonly exporter?: CountyPowerGoldMirrorExporter;
    readonly runner?: CountyPowerDuckDbRunner;
  }
): Promise<readonly LakeManifestArtifactRecord[]> {
  const env = args.env ?? process.env;
  const databaseUrl = resolveDatabaseUrl(env);
  const exporter = args.exporter ?? exportCountyPowerGoldMirrorCsv;
  const runner = args.runner ?? runDuckDbCli;
  const specs = buildCountyPowerGoldMartSpecs({
    context: args.context,
    publicationRunId: args.publicationRunId,
  });
  const countyScoreSnapshotSpec = specs.find((spec) => spec.name === "county_score_snapshot");
  const publicationSummarySpec = specs.find((spec) => spec.name === "publication_summary");

  if (
    countyScoreSnapshotSpec === undefined ||
    countyScoreSnapshotSpec.csvPath === null ||
    publicationSummarySpec === undefined ||
    publicationSummarySpec.csvPath === null
  ) {
    throw new Error("Missing county power gold mirror spec");
  }

  ensureDirectory(args.context.runDuckDbDir);
  if (!fileExists(args.context.runDuckDbBootstrapPath)) {
    writeDuckDbBootstrapSql(args.context.runDuckDbBootstrapPath);
  }

  for (const spec of specs) {
    rmSync(spec.outputRootPath, {
      force: true,
      recursive: true,
    });
    ensureDirectory(spec.outputRootPath);
    if (spec.csvPath !== null) {
      rmSync(spec.csvPath, { force: true });
    }
  }

  try {
    await exporter({
      context: args.context,
      csvPath: countyScoreSnapshotSpec.csvPath,
      databaseUrl,
      env,
      publicationRunId: args.publicationRunId,
      query: buildPostgresSnapshotMirrorQuery(args.publicationRunId),
    });
    await exporter({
      context: args.context,
      csvPath: publicationSummarySpec.csvPath,
      databaseUrl,
      env,
      publicationRunId: args.publicationRunId,
      query: buildPostgresPublicationMirrorQuery(args.publicationRunId),
    });

    const result = await runner({
      bootstrapPath: args.context.runDuckDbBootstrapPath,
      cwd: args.context.runDir,
      databasePath: args.context.runDuckDbPath,
      env,
      sql: buildCountyPowerGoldDuckDbSql({
        context: args.context,
        manifest: args.manifest,
        publicationRunId: args.publicationRunId,
        specs,
      }),
    });

    if (result.exitCode !== 0) {
      throw new Error(`county power gold parquet write failed: ${summarizeCommandFailure(result)}`);
    }

    for (const spec of specs) {
      if (!directoryContainsParquetFiles(spec.outputRootPath)) {
        throw new Error(`county power gold parquet artifact missing: ${spec.outputRootPath}`);
      }
    }

    return specs.map((spec) => spec.artifact);
  } finally {
    if (countyScoreSnapshotSpec.csvPath !== null) {
      rmSync(countyScoreSnapshotSpec.csvPath, { force: true });
    }
    if (publicationSummarySpec.csvPath !== null) {
      rmSync(publicationSummarySpec.csvPath, { force: true });
    }
  }
}
