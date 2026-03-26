import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ensureDirectory, fileExists, readJson, writeJsonAtomic } from "./atomic-file-store";
import {
  ensureBatchArtifactLayout,
  mergeLakeManifestArtifacts,
  resolveBatchArtifactLayout,
} from "./batch-artifact-layout";
import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";
import { writeCountyPowerGoldMartFiles } from "./county-power-gold-marts";
import type { CountyPowerGoldMirrorExporter } from "./county-power-gold-marts.types";
import { validateCountyPowerPublicationParity as validateCountyPowerPublicationParityImplementation } from "./county-power-parity";
import type {
  CountyPowerParityCsvExporter,
  CountyPowerParityDuckDbRunner,
} from "./county-power-parity.types";
import {
  buildCountyPowerLoadPayload as buildCountyPowerLoadPayloadImplementation,
  closeCountyPowerSql as closeCountyPowerSqlImplementation,
  createCountyPowerRunId as createCountyPowerRunIdImplementation,
  decodeCountyPowerBundleManifest as decodeCountyPowerBundleManifestImplementation,
  decodeCountyPowerRunConfig as decodeCountyPowerRunConfigImplementation,
  ensureCountyPowerRunDirectories as ensureCountyPowerRunDirectoriesImplementation,
  loadCountyPowerPayload as loadCountyPowerPayloadImplementation,
  materializeCountyPowerManifest as materializeCountyPowerManifestImplementation,
  normalizeCountyPowerBundle as normalizeCountyPowerBundleImplementation,
  readNormalizedCountyPowerBundle as readNormalizedCountyPowerBundleImplementation,
  resolveCountyPowerRunContext as resolveCountyPowerRunContextImplementation,
  verifyCountyPowerRunConfig as verifyCountyPowerRunConfigImplementation,
  writeCountyPowerRunConfig as writeCountyPowerRunConfigImplementation,
} from "./county-power-sync.impl.js";
import type {
  CountyPowerBundleManifest,
  CountyPowerLoadOptions,
  CountyPowerLoadPayload,
  CountyPowerMaterializedManifest,
  CountyPowerNormalizedBundle,
  CountyPowerRunConfig,
  CountyPowerRunContext,
} from "./county-power-sync.types";
import { runDuckDbCli } from "./duckdb-runner";
import type { DuckDbCliOptions } from "./duckdb-runner.types";

type CountyPowerDuckDbRunner = (options: DuckDbCliOptions) => Promise<{
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;

type CountyPowerSilverDatasetKey = keyof CountyPowerBundleManifest["datasets"];

interface CountyPowerSilverPartitionAlias {
  readonly sourceColumn: string;
  readonly targetColumn: string;
}

interface CountyPowerSilverConversionSpec {
  readonly artifact: LakeManifestArtifactRecord;
  readonly datasetKey: CountyPowerSilverDatasetKey;
  readonly inputPath: string;
  readonly manifestDatasetPath: string;
  readonly outputFilePath: string;
  readonly outputRootPath: string;
  readonly partitionAliases: readonly CountyPowerSilverPartitionAlias[];
}

interface CountyPowerParquetMaterializationSpec {
  readonly datasetKey: CountyPowerSilverDatasetKey;
  readonly inputGlob: string;
  readonly outputPath: string;
  readonly tempManifestPath: string;
}

const CAMEL_BOUNDARY_RE = /([a-z0-9])([A-Z])/g;
const COUNTY_POWER_SILVER_DATASET_KEYS: readonly CountyPowerSilverDatasetKey[] = [
  "congestion",
  "countyFipsAliases",
  "countyOperatorRegions",
  "countyOperatorZones",
  "fiber",
  "gas",
  "gridFriction",
  "operatorRegions",
  "operatorZoneReferences",
  "policyEvents",
  "policySnapshots",
  "powerMarketContext",
  "queueCountyResolutions",
  "queuePoiReferences",
  "queueProjects",
  "queueResolutionOverrides",
  "queueSnapshots",
  "queueUnresolved",
  "transmission",
  "utilityContext",
];
const PARQUET_FILE_NAME = "part-0.parquet";
const TEMP_NORMALIZED_MANIFEST_FILE_NAME = "normalized-manifest.json";
const SQL_STRING_ESCAPE_RE = /'/g;

function toSnakeCase(value: string): string {
  return value.replace(CAMEL_BOUNDARY_RE, "$1_$2").toLowerCase();
}

function normalizeManifestRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function toDuckDbStringLiteral(value: string): string {
  return `'${value.replace(SQL_STRING_ESCAPE_RE, "''")}'`;
}

function summarizeDuckDbFailure(result: {
  readonly stderr: string;
  readonly stdout: string;
}): string {
  const trimmedStderr = result.stderr.trim();
  if (trimmedStderr.length > 0) {
    return trimmedStderr;
  }

  const trimmedStdout = result.stdout.trim();
  if (trimmedStdout.length > 0) {
    return trimmedStdout;
  }

  return "DuckDB command produced no output";
}

function directoryContainsParquetFiles(path: string): boolean {
  if (!fileExists(path)) {
    return false;
  }

  for (const entry of readdirSync(path, {
    withFileTypes: true,
  })) {
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

function resolveCountyPowerSilverPartitionAliases(
  datasetKey: CountyPowerSilverDatasetKey
): readonly CountyPowerSilverPartitionAlias[] {
  switch (datasetKey) {
    case "policyEvents":
      return [
        {
          sourceColumn: "stateAbbrev",
          targetColumn: "state_abbrev",
        },
      ];
    case "queueCountyResolutions":
    case "queuePoiReferences":
    case "queueProjects":
    case "queueResolutionOverrides":
    case "queueSnapshots":
    case "queueUnresolved":
      return [
        {
          sourceColumn: "sourceSystem",
          targetColumn: "source_system",
        },
        {
          sourceColumn: "stateAbbrev",
          targetColumn: "state_abbrev",
        },
      ];
    default:
      return [];
  }
}

function buildCountyPowerSilverConversionSpecs(args: {
  readonly bundle: CountyPowerNormalizedBundle;
  readonly context: CountyPowerRunContext;
}): readonly CountyPowerSilverConversionSpec[] {
  return COUNTY_POWER_SILVER_DATASET_KEYS.map((datasetKey) => {
    const layer = toSnakeCase(datasetKey);
    const outputRootPath = join(args.context.silverPlainDir, `table=${layer}`);
    const partitionAliases = resolveCountyPowerSilverPartitionAliases(datasetKey);

    return {
      artifact: {
        format: "parquet",
        layer,
        partitionKeys: ["table", ...partitionAliases.map((alias) => alias.targetColumn)],
        phase: "silver-plain",
        relativePath: normalizeManifestRelativePath(relative(args.context.runDir, outputRootPath)),
      },
      datasetKey,
      inputPath: join(args.context.normalizedDir, args.bundle.manifest.datasets[datasetKey].path),
      manifestDatasetPath: normalizeManifestRelativePath(
        relative(args.context.normalizedDir, outputRootPath)
      ),
      outputFilePath: join(outputRootPath, PARQUET_FILE_NAME),
      outputRootPath,
      partitionAliases,
    };
  });
}

function buildCountyPowerSilverProjectionSql(spec: CountyPowerSilverConversionSpec): string {
  if (spec.partitionAliases.length === 0) {
    return `SELECT *
  FROM read_ndjson_auto(${toDuckDbStringLiteral(spec.inputPath)})`;
  }

  return `SELECT *,
  ${spec.partitionAliases
    .map((alias) => `${alias.sourceColumn} AS ${alias.targetColumn}`)
    .join(",\n  ")}
  FROM read_ndjson_auto(${toDuckDbStringLiteral(spec.inputPath)})`;
}

function buildCountyPowerSilverCopySql(spec: CountyPowerSilverConversionSpec): string {
  if (spec.partitionAliases.length === 0) {
    return `COPY (
  ${buildCountyPowerSilverProjectionSql(spec)}
) TO ${toDuckDbStringLiteral(spec.outputFilePath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD
);`;
  }

  return `COPY (
  ${buildCountyPowerSilverProjectionSql(spec)}
) TO ${toDuckDbStringLiteral(spec.outputRootPath)} (
  FORMAT PARQUET,
  COMPRESSION ZSTD,
  FILENAME_PATTERN 'part-{i}',
  PARTITION_BY (${spec.partitionAliases.map((alias) => alias.targetColumn).join(", ")})
);`;
}

function buildCountyPowerSilverParquetSql(
  specs: readonly CountyPowerSilverConversionSpec[]
): string {
  return [
    "PRAGMA disable_progress_bar;",
    "INSTALL json;",
    "LOAD json;",
    ...specs.map((spec) => buildCountyPowerSilverCopySql(spec)),
  ].join("\n\n");
}

function getRequiredCountyPowerSilverSpec(
  specs: readonly CountyPowerSilverConversionSpec[],
  datasetKey: CountyPowerSilverDatasetKey
): CountyPowerSilverConversionSpec {
  const spec = specs.find((candidate) => candidate.datasetKey === datasetKey);
  if (spec === undefined) {
    throw new Error(`Missing county power silver conversion spec for ${datasetKey}`);
  }

  return spec;
}

function buildCountyPowerSilverManifest(args: {
  readonly bundle: CountyPowerNormalizedBundle;
  readonly specs: readonly CountyPowerSilverConversionSpec[];
}): CountyPowerBundleManifest {
  return {
    ...args.bundle.manifest,
    datasets: {
      congestion: {
        ...args.bundle.manifest.datasets.congestion,
        path: getRequiredCountyPowerSilverSpec(args.specs, "congestion").manifestDatasetPath,
      },
      countyFipsAliases: {
        ...args.bundle.manifest.datasets.countyFipsAliases,
        path: getRequiredCountyPowerSilverSpec(args.specs, "countyFipsAliases").manifestDatasetPath,
      },
      countyOperatorRegions: {
        ...args.bundle.manifest.datasets.countyOperatorRegions,
        path: getRequiredCountyPowerSilverSpec(args.specs, "countyOperatorRegions")
          .manifestDatasetPath,
      },
      countyOperatorZones: {
        ...args.bundle.manifest.datasets.countyOperatorZones,
        path: getRequiredCountyPowerSilverSpec(args.specs, "countyOperatorZones")
          .manifestDatasetPath,
      },
      fiber: {
        ...args.bundle.manifest.datasets.fiber,
        path: getRequiredCountyPowerSilverSpec(args.specs, "fiber").manifestDatasetPath,
      },
      gas: {
        ...args.bundle.manifest.datasets.gas,
        path: getRequiredCountyPowerSilverSpec(args.specs, "gas").manifestDatasetPath,
      },
      gridFriction: {
        ...args.bundle.manifest.datasets.gridFriction,
        path: getRequiredCountyPowerSilverSpec(args.specs, "gridFriction").manifestDatasetPath,
      },
      operatorRegions: {
        ...args.bundle.manifest.datasets.operatorRegions,
        path: getRequiredCountyPowerSilverSpec(args.specs, "operatorRegions").manifestDatasetPath,
      },
      operatorZoneReferences: {
        ...args.bundle.manifest.datasets.operatorZoneReferences,
        path: getRequiredCountyPowerSilverSpec(args.specs, "operatorZoneReferences")
          .manifestDatasetPath,
      },
      policyEvents: {
        ...args.bundle.manifest.datasets.policyEvents,
        path: getRequiredCountyPowerSilverSpec(args.specs, "policyEvents").manifestDatasetPath,
      },
      policySnapshots: {
        ...args.bundle.manifest.datasets.policySnapshots,
        path: getRequiredCountyPowerSilverSpec(args.specs, "policySnapshots").manifestDatasetPath,
      },
      powerMarketContext: {
        ...args.bundle.manifest.datasets.powerMarketContext,
        path: getRequiredCountyPowerSilverSpec(args.specs, "powerMarketContext")
          .manifestDatasetPath,
      },
      queuePoiReferences: {
        ...args.bundle.manifest.datasets.queuePoiReferences,
        path: getRequiredCountyPowerSilverSpec(args.specs, "queuePoiReferences")
          .manifestDatasetPath,
      },
      queueCountyResolutions: {
        ...args.bundle.manifest.datasets.queueCountyResolutions,
        path: getRequiredCountyPowerSilverSpec(args.specs, "queueCountyResolutions")
          .manifestDatasetPath,
      },
      queueProjects: {
        ...args.bundle.manifest.datasets.queueProjects,
        path: getRequiredCountyPowerSilverSpec(args.specs, "queueProjects").manifestDatasetPath,
      },
      queueResolutionOverrides: {
        ...args.bundle.manifest.datasets.queueResolutionOverrides,
        path: getRequiredCountyPowerSilverSpec(args.specs, "queueResolutionOverrides")
          .manifestDatasetPath,
      },
      queueSnapshots: {
        ...args.bundle.manifest.datasets.queueSnapshots,
        path: getRequiredCountyPowerSilverSpec(args.specs, "queueSnapshots").manifestDatasetPath,
      },
      queueUnresolved: {
        ...args.bundle.manifest.datasets.queueUnresolved,
        path: getRequiredCountyPowerSilverSpec(args.specs, "queueUnresolved").manifestDatasetPath,
      },
      transmission: {
        ...args.bundle.manifest.datasets.transmission,
        path: getRequiredCountyPowerSilverSpec(args.specs, "transmission").manifestDatasetPath,
      },
      utilityContext: {
        ...args.bundle.manifest.datasets.utilityContext,
        path: getRequiredCountyPowerSilverSpec(args.specs, "utilityContext").manifestDatasetPath,
      },
    },
  };
}

async function writeCountyPowerSilverParquetWithRunner(args: {
  readonly bundle: CountyPowerNormalizedBundle;
  readonly context: CountyPowerRunContext;
  readonly runner: CountyPowerDuckDbRunner;
}): Promise<readonly LakeManifestArtifactRecord[]> {
  const specs = buildCountyPowerSilverConversionSpecs(args);

  for (const spec of specs) {
    rmSync(spec.outputRootPath, {
      force: true,
      recursive: true,
    });
    ensureDirectory(spec.outputRootPath);
  }

  const result = await args.runner({
    bootstrapPath: args.context.runDuckDbBootstrapPath,
    cwd: args.context.runDir,
    databasePath: args.context.runDuckDbPath,
    sql: buildCountyPowerSilverParquetSql(specs),
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `county power silver parquet dual-write failed: ${summarizeDuckDbFailure(result)}`
    );
  }

  for (const spec of specs) {
    if (!directoryContainsParquetFiles(spec.outputRootPath)) {
      throw new Error(`county power silver parquet artifact missing: ${spec.outputRootPath}`);
    }
  }

  writeJsonAtomic(
    args.context.normalizedManifestPath,
    buildCountyPowerSilverManifest({
      bundle: args.bundle,
      specs,
    })
  );
  ensureBatchArtifactLayout({
    artifacts: specs.map((spec) => spec.artifact),
    dataVersion: args.bundle.manifest.dataVersion,
    effectiveDate: args.bundle.manifest.effectiveDate,
    layout: args.context,
    month: args.bundle.manifest.month,
  });

  return specs.map((spec) => spec.artifact);
}

function buildCountyPowerParquetMaterializationSpecs(args: {
  readonly manifest: CountyPowerBundleManifest;
  readonly normalizedManifestPath: string;
  readonly tempDir: string;
}): readonly CountyPowerParquetMaterializationSpec[] {
  return COUNTY_POWER_SILVER_DATASET_KEYS.map((datasetKey) => {
    const layer = toSnakeCase(datasetKey);
    const sourcePath = resolve(
      dirname(args.normalizedManifestPath),
      args.manifest.datasets[datasetKey].path
    );

    return {
      datasetKey,
      inputGlob: sourcePath.endsWith(".parquet") ? sourcePath : join(sourcePath, "**", "*.parquet"),
      outputPath: join(args.tempDir, `${layer}.ndjson`),
      tempManifestPath: `${layer}.ndjson`,
    };
  });
}

function buildCountyPowerParquetMaterializationSql(
  specs: readonly CountyPowerParquetMaterializationSpec[]
): string {
  return [
    "PRAGMA disable_progress_bar;",
    "INSTALL json;",
    "LOAD json;",
    ...specs.map(
      (spec) => `COPY (
  SELECT *
  FROM read_parquet(${toDuckDbStringLiteral(spec.inputGlob)}, hive_partitioning = true)
) TO ${toDuckDbStringLiteral(spec.outputPath)} (
  FORMAT JSON,
  ARRAY false
);`
    ),
  ].join("\n\n");
}

function buildCountyPowerParquetMaterializationManifest(args: {
  readonly manifest: CountyPowerBundleManifest;
  readonly specs: readonly CountyPowerParquetMaterializationSpec[];
}): CountyPowerBundleManifest {
  return {
    ...args.manifest,
    datasets: {
      congestion: {
        ...args.manifest.datasets.congestion,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "congestion")
          .tempManifestPath,
      },
      countyFipsAliases: {
        ...args.manifest.datasets.countyFipsAliases,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "countyFipsAliases")
          .tempManifestPath,
      },
      countyOperatorRegions: {
        ...args.manifest.datasets.countyOperatorRegions,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "countyOperatorRegions")
          .tempManifestPath,
      },
      countyOperatorZones: {
        ...args.manifest.datasets.countyOperatorZones,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "countyOperatorZones")
          .tempManifestPath,
      },
      fiber: {
        ...args.manifest.datasets.fiber,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "fiber")
          .tempManifestPath,
      },
      gas: {
        ...args.manifest.datasets.gas,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "gas").tempManifestPath,
      },
      gridFriction: {
        ...args.manifest.datasets.gridFriction,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "gridFriction")
          .tempManifestPath,
      },
      operatorRegions: {
        ...args.manifest.datasets.operatorRegions,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "operatorRegions")
          .tempManifestPath,
      },
      operatorZoneReferences: {
        ...args.manifest.datasets.operatorZoneReferences,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "operatorZoneReferences")
          .tempManifestPath,
      },
      policyEvents: {
        ...args.manifest.datasets.policyEvents,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "policyEvents")
          .tempManifestPath,
      },
      policySnapshots: {
        ...args.manifest.datasets.policySnapshots,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "policySnapshots")
          .tempManifestPath,
      },
      powerMarketContext: {
        ...args.manifest.datasets.powerMarketContext,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "powerMarketContext")
          .tempManifestPath,
      },
      queuePoiReferences: {
        ...args.manifest.datasets.queuePoiReferences,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "queuePoiReferences")
          .tempManifestPath,
      },
      queueCountyResolutions: {
        ...args.manifest.datasets.queueCountyResolutions,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "queueCountyResolutions")
          .tempManifestPath,
      },
      queueProjects: {
        ...args.manifest.datasets.queueProjects,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "queueProjects")
          .tempManifestPath,
      },
      queueResolutionOverrides: {
        ...args.manifest.datasets.queueResolutionOverrides,
        path: getRequiredCountyPowerParquetMaterializationSpec(
          args.specs,
          "queueResolutionOverrides"
        ).tempManifestPath,
      },
      queueSnapshots: {
        ...args.manifest.datasets.queueSnapshots,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "queueSnapshots")
          .tempManifestPath,
      },
      queueUnresolved: {
        ...args.manifest.datasets.queueUnresolved,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "queueUnresolved")
          .tempManifestPath,
      },
      transmission: {
        ...args.manifest.datasets.transmission,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "transmission")
          .tempManifestPath,
      },
      utilityContext: {
        ...args.manifest.datasets.utilityContext,
        path: getRequiredCountyPowerParquetMaterializationSpec(args.specs, "utilityContext")
          .tempManifestPath,
      },
    },
  };
}

function getRequiredCountyPowerParquetMaterializationSpec(
  specs: readonly CountyPowerParquetMaterializationSpec[],
  datasetKey: CountyPowerSilverDatasetKey
): CountyPowerParquetMaterializationSpec {
  const spec = specs.find((candidate) => candidate.datasetKey === datasetKey);
  if (spec === undefined) {
    throw new Error(`Missing county power parquet materialization spec for ${datasetKey}`);
  }

  return spec;
}

function isLegacyNdjsonManifest(manifest: CountyPowerBundleManifest): boolean {
  return COUNTY_POWER_SILVER_DATASET_KEYS.every((datasetKey) =>
    manifest.datasets[datasetKey].path.endsWith(".ndjson")
  );
}

function mapCountyPowerNormalizedBundle(args: {
  readonly bundle: Omit<CountyPowerNormalizedBundle, "manifest"> & {
    readonly manifest: unknown;
  };
  readonly manifest: CountyPowerBundleManifest;
}): CountyPowerNormalizedBundle {
  return {
    congestion: args.bundle.congestion,
    countyFipsAliases: args.bundle.countyFipsAliases,
    countyOperatorRegions: args.bundle.countyOperatorRegions,
    countyOperatorZones: args.bundle.countyOperatorZones,
    fiber: args.bundle.fiber,
    gas: args.bundle.gas,
    gridFriction: args.bundle.gridFriction,
    manifest: args.manifest,
    operatorRegions: args.bundle.operatorRegions,
    operatorZoneReferences: args.bundle.operatorZoneReferences,
    policyEvents: args.bundle.policyEvents,
    policySnapshots: args.bundle.policySnapshots,
    powerMarketContext: args.bundle.powerMarketContext,
    queuePoiReferences: args.bundle.queuePoiReferences,
    queueCountyResolutions: args.bundle.queueCountyResolutions,
    queueProjects: args.bundle.queueProjects,
    queueResolutionOverrides: args.bundle.queueResolutionOverrides,
    queueSnapshots: args.bundle.queueSnapshots,
    queueUnresolved: args.bundle.queueUnresolved,
    transmission: args.bundle.transmission,
    utilityContext: args.bundle.utilityContext,
  };
}

function resolveCountyPowerDuckDbPathsForNormalizedManifest(path: string): {
  readonly bootstrapPath: string;
  readonly databasePath: string;
  readonly runDir: string;
} {
  const normalizedDir = dirname(path);
  const runDir = dirname(normalizedDir);

  return {
    bootstrapPath: join(runDir, "duckdb", "bootstrap.sql"),
    databasePath: join(runDir, "duckdb", "run.duckdb"),
    runDir,
  };
}

async function materializeCountyPowerParquetBundleWithRunner(args: {
  readonly normalizedManifestPath: string;
  readonly manifest: CountyPowerBundleManifest;
  readonly runner: CountyPowerDuckDbRunner;
}): Promise<CountyPowerNormalizedBundle> {
  const tempDir = mkdtempSync(join(dirname(args.normalizedManifestPath), ".county-power-read-"));
  const specs = buildCountyPowerParquetMaterializationSpecs({
    manifest: args.manifest,
    normalizedManifestPath: args.normalizedManifestPath,
    tempDir,
  });

  try {
    const duckDbPaths = resolveCountyPowerDuckDbPathsForNormalizedManifest(
      args.normalizedManifestPath
    );
    const result = await args.runner({
      bootstrapPath: duckDbPaths.bootstrapPath,
      cwd: duckDbPaths.runDir,
      databasePath: duckDbPaths.databasePath,
      sql: buildCountyPowerParquetMaterializationSql(specs),
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `county power parquet materialization failed: ${summarizeDuckDbFailure(result)}`
      );
    }

    for (const spec of specs) {
      if (!fileExists(spec.outputPath)) {
        throw new Error(`county power parquet materialization missing: ${spec.outputPath}`);
      }
    }

    const tempManifestPath = join(tempDir, TEMP_NORMALIZED_MANIFEST_FILE_NAME);
    writeJsonAtomic(
      tempManifestPath,
      buildCountyPowerParquetMaterializationManifest({
        manifest: args.manifest,
        specs,
      })
    );

    return mapCountyPowerNormalizedBundle({
      bundle: readNormalizedCountyPowerBundleImplementation(tempManifestPath),
      manifest: args.manifest,
    });
  } finally {
    rmSync(tempDir, {
      force: true,
      recursive: true,
    });
  }
}

export function createCountyPowerRunId(date?: Date): string {
  return createCountyPowerRunIdImplementation(date);
}

export function resolveCountyPowerRunContext(
  projectRoot: string,
  runId: string,
  env?: NodeJS.ProcessEnv
): CountyPowerRunContext {
  const context = resolveCountyPowerRunContextImplementation(projectRoot, runId, env);
  const layout = resolveBatchArtifactLayout({
    dataset: "county-power",
    projectRoot,
    runId,
    snapshotRoot: context.snapshotRoot,
    ...(env === undefined ? {} : { env }),
  });

  return {
    ...context,
    ...layout,
  };
}

export function ensureCountyPowerRunDirectories(context: CountyPowerRunContext): void {
  ensureCountyPowerRunDirectoriesImplementation(context);
  ensureBatchArtifactLayout({
    layout: context,
  });
}

export function writeCountyPowerRunConfig(
  path: string,
  config: Omit<CountyPowerRunConfig, "createdAt">
): void {
  writeCountyPowerRunConfigImplementation(path, config);
}

export function verifyCountyPowerRunConfig(
  path: string,
  expected: Omit<CountyPowerRunConfig, "createdAt">
): void {
  verifyCountyPowerRunConfigImplementation(path, expected);
}

export function decodeCountyPowerRunConfig(value: unknown): CountyPowerRunConfig {
  return decodeCountyPowerRunConfigImplementation(value);
}

export function decodeCountyPowerBundleManifest(value: unknown): CountyPowerBundleManifest {
  const manifest = decodeCountyPowerBundleManifestImplementation(value);

  return {
    bundleVersion: "county-power-v1",
    dataVersion: manifest.dataVersion,
    datasets: {
      congestion: manifest.datasets.congestion,
      countyFipsAliases: manifest.datasets.countyFipsAliases,
      countyOperatorRegions: manifest.datasets.countyOperatorRegions,
      countyOperatorZones: manifest.datasets.countyOperatorZones,
      fiber: manifest.datasets.fiber,
      gas: manifest.datasets.gas,
      gridFriction: manifest.datasets.gridFriction,
      operatorRegions: manifest.datasets.operatorRegions,
      operatorZoneReferences: manifest.datasets.operatorZoneReferences,
      policyEvents: manifest.datasets.policyEvents,
      policySnapshots: manifest.datasets.policySnapshots,
      powerMarketContext: manifest.datasets.powerMarketContext,
      queuePoiReferences: manifest.datasets.queuePoiReferences,
      queueCountyResolutions: manifest.datasets.queueCountyResolutions,
      queueProjects: manifest.datasets.queueProjects,
      queueResolutionOverrides: manifest.datasets.queueResolutionOverrides,
      queueSnapshots: manifest.datasets.queueSnapshots,
      queueUnresolved: manifest.datasets.queueUnresolved,
      transmission: manifest.datasets.transmission,
      utilityContext: manifest.datasets.utilityContext,
    },
    effectiveDate: manifest.effectiveDate,
    generatedAt: manifest.generatedAt,
    month: manifest.month,
  };
}

export async function materializeCountyPowerManifest(args: {
  readonly manifestPath?: string;
  readonly manifestUrl?: string;
  readonly rawDir: string;
  readonly rawManifestPath: string;
}): Promise<CountyPowerMaterializedManifest> {
  const result = await materializeCountyPowerManifestImplementation(args);

  return {
    localManifestPath: result.localManifestPath,
    manifest: decodeCountyPowerBundleManifest(result.manifest),
    manifestPath: result.manifestPath,
    manifestUrl: result.manifestUrl,
  };
}

export function normalizeCountyPowerBundle(args: {
  readonly normalizedDir: string;
  readonly normalizedManifestPath: string;
  readonly rawManifestPath: string;
}): CountyPowerNormalizedBundle {
  const bundle = normalizeCountyPowerBundleImplementation(args);

  return {
    congestion: bundle.congestion,
    countyFipsAliases: bundle.countyFipsAliases,
    countyOperatorRegions: bundle.countyOperatorRegions,
    countyOperatorZones: bundle.countyOperatorZones,
    fiber: bundle.fiber,
    gas: bundle.gas,
    gridFriction: bundle.gridFriction,
    manifest: decodeCountyPowerBundleManifest(bundle.manifest),
    operatorRegions: bundle.operatorRegions,
    operatorZoneReferences: bundle.operatorZoneReferences,
    policyEvents: bundle.policyEvents,
    policySnapshots: bundle.policySnapshots,
    powerMarketContext: bundle.powerMarketContext,
    queuePoiReferences: bundle.queuePoiReferences,
    queueCountyResolutions: bundle.queueCountyResolutions,
    queueProjects: bundle.queueProjects,
    queueResolutionOverrides: bundle.queueResolutionOverrides,
    queueSnapshots: bundle.queueSnapshots,
    queueUnresolved: bundle.queueUnresolved,
    transmission: bundle.transmission,
    utilityContext: bundle.utilityContext,
  };
}

export function writeCountyPowerSilverParquet(args: {
  readonly bundle: CountyPowerNormalizedBundle;
  readonly context: CountyPowerRunContext;
  readonly runner?: CountyPowerDuckDbRunner;
}): Promise<readonly LakeManifestArtifactRecord[]> {
  return writeCountyPowerSilverParquetWithRunner({
    bundle: args.bundle,
    context: args.context,
    runner: args.runner ?? runDuckDbCli,
  });
}

export async function writeCountyPowerGoldMarts(args: {
  readonly context: CountyPowerRunContext;
  readonly env?: NodeJS.ProcessEnv;
  readonly exporter?: CountyPowerGoldMirrorExporter;
  readonly manifest: CountyPowerBundleManifest;
  readonly publicationRunId: string;
  readonly runner?: CountyPowerDuckDbRunner;
}): Promise<readonly LakeManifestArtifactRecord[]> {
  const artifacts = await writeCountyPowerGoldMartFiles({
    context: args.context,
    ...(args.env === undefined ? {} : { env: args.env }),
    ...(args.exporter === undefined ? {} : { exporter: args.exporter }),
    manifest: args.manifest,
    publicationRunId: args.publicationRunId,
    ...(args.runner === undefined ? {} : { runner: args.runner }),
  });

  mergeLakeManifestArtifacts({
    artifacts,
    dataVersion: args.manifest.dataVersion,
    effectiveDate: args.manifest.effectiveDate,
    layout: args.context,
    month: args.manifest.month,
  });

  return artifacts;
}

export function validateCountyPowerPublicationParity(args: {
  readonly context: CountyPowerRunContext;
  readonly emitQa?: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly exporter?: CountyPowerParityCsvExporter;
  readonly failFast?: boolean;
  readonly manifest: CountyPowerBundleManifest;
  readonly publicationRunId: string;
  readonly runner?: CountyPowerParityDuckDbRunner;
}) {
  return validateCountyPowerPublicationParityImplementation({
    context: args.context,
    ...(args.emitQa === undefined ? {} : { emitQa: args.emitQa }),
    ...(args.env === undefined ? {} : { env: args.env }),
    ...(args.exporter === undefined ? {} : { exporter: args.exporter }),
    ...(args.failFast === undefined ? {} : { failFast: args.failFast }),
    manifest: args.manifest,
    publicationRunId: args.publicationRunId,
    ...(args.runner === undefined ? {} : { runner: args.runner }),
  });
}

export function readNormalizedCountyPowerBundle(
  path: string,
  runner: CountyPowerDuckDbRunner = runDuckDbCli
): Promise<CountyPowerNormalizedBundle> {
  const manifest = decodeCountyPowerBundleManifest(
    readJson(path, decodeCountyPowerBundleManifestImplementation)
  );

  if (isLegacyNdjsonManifest(manifest)) {
    return Promise.resolve(
      mapCountyPowerNormalizedBundle({
        bundle: readNormalizedCountyPowerBundleImplementation(path),
        manifest,
      })
    );
  }

  return materializeCountyPowerParquetBundleWithRunner({
    manifest,
    normalizedManifestPath: path,
    runner,
  });
}

export function buildCountyPowerLoadPayload(
  bundle: CountyPowerNormalizedBundle,
  options: CountyPowerLoadOptions
): CountyPowerLoadPayload {
  return buildCountyPowerLoadPayloadImplementation(bundle, options);
}

export async function loadCountyPowerPayload(payload: CountyPowerLoadPayload): Promise<void> {
  await loadCountyPowerPayloadImplementation(payload);
}

export async function closeCountyPowerSql(): Promise<void> {
  await closeCountyPowerSqlImplementation();
}
