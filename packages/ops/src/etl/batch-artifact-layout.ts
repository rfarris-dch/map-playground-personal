import { join, resolve } from "node:path";
import { ensureDirectory, readJsonOption, writeJsonAtomic } from "./atomic-file-store";
import type {
  BatchArtifactDataset,
  BatchRunArtifactLayout,
  CreateLakeManifestRecordInput,
  DatasetLakeConventionRecord,
  LakeManifestArtifactRecord,
  LakeManifestRecord,
} from "./batch-artifact-layout.types";
import { DEFAULT_DUCKDB_BOOTSTRAP_EXTENSIONS, writeDuckDbBootstrapSql } from "./duckdb-bootstrap";
import { defaultSnapshotRootForDataset, resolveProjectRootFromFileUrl } from "./project-paths";

const DEFAULT_BBOX_COLUMNS: readonly string[] = ["xmin", "ymin", "xmax", "ymax"];
const DEFAULT_PROVENANCE_FIELDS: readonly string[] = [
  "run_id",
  "data_version",
  "effective_date",
  "source_as_of_date",
  "model_version",
  "publication_run_id",
];
const DATASET_LAKE_CONVENTIONS: Record<BatchArtifactDataset, DatasetLakeConventionRecord> = {
  boundaries: {
    dataset: "boundaries",
    notes: [
      "Boundary GeoParquet sidecars should be versioned and published from file-native canonical geometry.",
      "Adjacency edges stay plain Parquet and are treated as graph/mart artifacts.",
      "County adjacency artifacts must preserve shared_boundary_meters and point_touch so catchment rollups can distinguish shared-edge and point-touch neighbors.",
    ],
    partitionRules: [
      {
        artifactFamily: "boundary-geometries",
        description: "County LOD tables and other boundary geometry sidecars.",
        format: "geoparquet",
        partitionKeys: ["data_version", "layer"],
        phase: "lake",
        relativeLayoutTemplate:
          "data_version=<date>/layer=<county_lod1|county_lod2|county_lod3|...>/part-*.parquet",
      },
      {
        artifactFamily: "adjacency-edges",
        description:
          "Boundary-derived graph outputs such as county adjacency, preserving shared_boundary_meters and point_touch for later catchment weighting.",
        format: "parquet",
        partitionKeys: ["boundary_version"],
        phase: "gold",
        relativeLayoutTemplate:
          "gold/plain/mart=county_adjacency/boundary_version=<version>/part-*.parquet",
      },
    ],
  },
  "county-power": {
    dataset: "county-power",
    notes: [
      "Small normalized families should stay one file per table per run until Parquet dual-write lands.",
      "Large queue, policy, and event families should partition first by source_system and only then by state_abbrev when needed.",
    ],
    partitionRules: [
      {
        artifactFamily: "normalized-small-tables",
        description:
          "Small county-power normalized Parquet families such as aliases, fiber, gas, and utility context.",
        format: "parquet",
        partitionKeys: ["data_version", "table"],
        phase: "silver",
        relativeLayoutTemplate: "data_version=<date>/table=<family>/part-*.parquet",
      },
      {
        artifactFamily: "normalized-large-families",
        description: "Large queue, policy, and event families with source-aware partitioning.",
        format: "parquet",
        partitionKeys: ["data_version", "table", "source_system", "state_abbrev"],
        phase: "silver",
        relativeLayoutTemplate:
          "data_version=<date>/table=<family>/source_system=<source>/state_abbrev=<state>/part-*.parquet",
      },
      {
        artifactFamily: "gold-marts",
        description:
          "Publication-level marts for county score, publication, QA, and debug outputs.",
        format: "parquet",
        partitionKeys: ["publication_run_id"],
        phase: "gold",
        relativeLayoutTemplate: "gold/plain/mart=<name>/publication_run_id=<run>/part-*.parquet",
      },
      {
        artifactFamily: "publication-parity",
        description:
          "Publication-time parity QA artifacts for Postgres-vs-Parquet validation summaries and assertions.",
        format: "parquet",
        partitionKeys: [],
        phase: "qa",
        relativeLayoutTemplate: "qa/<assertions|profile>.parquet",
      },
    ],
  },
  "environmental-flood": {
    dataset: "environmental-flood",
    notes: [
      "Flood canonical storage is GeoParquet-first, while PostGIS remains the published serving copy.",
      "Source state-unit partitioning stays available when upstream packaging makes it useful.",
    ],
    partitionRules: [
      {
        artifactFamily: "flood-canonical",
        description: "Flood hazard canonical GeoParquet families, including 100 and 500 overlays.",
        format: "geoparquet",
        partitionKeys: ["data_version", "flood_band", "source_state_unit"],
        phase: "lake",
        relativeLayoutTemplate:
          "data_version=<date>/flood_band=<100|500|full>/source_state_unit=<unit>/part-*.parquet",
      },
      {
        artifactFamily: "tile-input-parity",
        description:
          "Flood tile-input parity QA artifacts comparing the file-native GeoPackage handoff against legacy PostGIS overlay tables.",
        format: "parquet",
        partitionKeys: [],
        phase: "qa",
        relativeLayoutTemplate: "qa/<assertions|profile>.parquet",
      },
    ],
  },
  "environmental-hydro-basins": {
    dataset: "environmental-hydro-basins",
    notes: ["Hydro basins are immutable vector layers and should stay canonical in GeoParquet."],
    partitionRules: [
      {
        artifactFamily: "hydro-canonical",
        description: "HUC fill, line, and label families by level and feature kind.",
        format: "geoparquet",
        partitionKeys: ["data_version", "huc_level", "feature_kind"],
        phase: "lake",
        relativeLayoutTemplate:
          "data_version=<date>/huc_level=<4|6|8|10|12>/feature_kind=<polygon|line|label>/part-*.parquet",
      },
    ],
  },
  "market-boundaries": {
    dataset: "market-boundaries",
    notes: [
      "Market boundaries should be versioned GeoParquet artifacts before any Postgres publish step.",
    ],
    partitionRules: [
      {
        artifactFamily: "market-boundary-geometries",
        description: "Versioned market boundary GeoParquet outputs.",
        format: "geoparquet",
        partitionKeys: ["data_version"],
        phase: "lake",
        relativeLayoutTemplate: "data_version=<date>/part-*.parquet",
      },
    ],
  },
  parcels: {
    dataset: "parcels",
    notes: [
      "Do not emit a single national parcel file; state2 is the first partition boundary.",
      "county_geoid subpartitioning only turns on for very large state partitions.",
    ],
    partitionRules: [
      {
        artifactFamily: "parcels-canonical",
        description:
          "Canonical parcel GeoParquet with state-first partitioning and optional county_geoid split.",
        format: "geoparquet",
        partitionKeys: ["data_version", "state2", "county_geoid"],
        phase: "lake",
        relativeLayoutTemplate:
          "data_version=<date>/state2=<state>/county_geoid=<optional-county>/part-*.parquet",
      },
      {
        artifactFamily: "parcel-qa-marts",
        description: "Optional attribute-only marts for QA and operational analysis.",
        format: "parquet",
        partitionKeys: ["data_version", "state2"],
        phase: "qa",
        relativeLayoutTemplate: "qa/mart=<name>/data_version=<date>/state2=<state>/part-*.parquet",
      },
    ],
  },
};

function trimToNull(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function defaultLakeDatasetRoot(dataset: BatchArtifactDataset, env: NodeJS.ProcessEnv): string {
  const globalRoot = trimToNull(env.MAP_LAKE_ROOT);

  switch (dataset) {
    case "boundaries":
      return trimToNull(env.BOUNDARIES_LAKE_ROOT) ?? join(globalRoot ?? "var/lake", "boundaries");
    case "county-power":
      return (
        trimToNull(env.COUNTY_POWER_LAKE_ROOT) ?? join(globalRoot ?? "var/lake", "county-power")
      );
    case "environmental-flood":
      return (
        trimToNull(env.ENVIRONMENTAL_FLOOD_LAKE_ROOT) ??
        join(globalRoot ?? "var/lake", "environmental-flood")
      );
    case "environmental-hydro-basins":
      return (
        trimToNull(env.ENVIRONMENTAL_HYDRO_LAKE_ROOT) ??
        join(globalRoot ?? "var/lake", "environmental-hydro-basins")
      );
    case "market-boundaries":
      return (
        trimToNull(env.MARKET_BOUNDARIES_LAKE_ROOT) ??
        join(globalRoot ?? "var/lake", "market-boundaries")
      );
    case "parcels":
      return trimToNull(env.PARCEL_SYNC_LAKE_ROOT) ?? join(globalRoot ?? "var/lake", "parcels");
    default:
      return join(globalRoot ?? "var/lake", dataset);
  }
}

function defaultDuckDbDatasetRoot(dataset: BatchArtifactDataset, env: NodeJS.ProcessEnv): string {
  const globalRoot = trimToNull(env.MAP_DUCKDB_ROOT);

  switch (dataset) {
    case "boundaries":
      return (
        trimToNull(env.BOUNDARIES_DUCKDB_ROOT) ?? join(globalRoot ?? "var/duckdb", "boundaries")
      );
    case "county-power":
      return (
        trimToNull(env.COUNTY_POWER_DUCKDB_ROOT) ?? join(globalRoot ?? "var/duckdb", "county-power")
      );
    case "environmental-flood":
      return (
        trimToNull(env.ENVIRONMENTAL_FLOOD_DUCKDB_ROOT) ??
        join(globalRoot ?? "var/duckdb", "environmental-flood")
      );
    case "environmental-hydro-basins":
      return (
        trimToNull(env.ENVIRONMENTAL_HYDRO_DUCKDB_ROOT) ??
        join(globalRoot ?? "var/duckdb", "environmental-hydro-basins")
      );
    case "market-boundaries":
      return (
        trimToNull(env.MARKET_BOUNDARIES_DUCKDB_ROOT) ??
        join(globalRoot ?? "var/duckdb", "market-boundaries")
      );
    case "parcels":
      return trimToNull(env.PARCEL_SYNC_DUCKDB_ROOT) ?? join(globalRoot ?? "var/duckdb", "parcels");
    default:
      return join(globalRoot ?? "var/duckdb", dataset);
  }
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeLakeManifestArtifactRecord(value: unknown): LakeManifestArtifactRecord {
  if (!isJsonRecord(value)) {
    throw new Error("Expected lake manifest artifact record");
  }

  const { format, layer, partitionKeys, phase, relativePath } = value;
  if (format !== "geoparquet" && format !== "parquet") {
    throw new Error("Expected artifact format to be parquet or geoparquet");
  }
  if (typeof layer !== "string") {
    throw new Error("Expected artifact layer to be a string");
  }
  if (
    !(
      Array.isArray(partitionKeys) &&
      partitionKeys.every((partitionKey) => typeof partitionKey === "string")
    )
  ) {
    throw new Error("Expected artifact partition keys to be a string array");
  }
  if (
    phase !== "gold-plain" &&
    phase !== "gold-spatial" &&
    phase !== "lake-plain" &&
    phase !== "lake-spatial" &&
    phase !== "qa-plain" &&
    phase !== "silver-plain" &&
    phase !== "silver-spatial"
  ) {
    throw new Error("Expected artifact phase to be a known batch artifact phase");
  }
  if (typeof relativePath !== "string") {
    throw new Error("Expected artifact relative path to be a string");
  }

  return {
    format,
    layer,
    partitionKeys,
    phase,
    relativePath,
  };
}

function decodeExistingLakeManifestRecord(value: unknown): {
  readonly artifacts: readonly LakeManifestArtifactRecord[];
  readonly createdAt: string | null;
} {
  if (!isJsonRecord(value)) {
    throw new Error("Expected lake manifest record");
  }

  const { artifacts, createdAt } = value;
  if (!Array.isArray(artifacts)) {
    throw new Error("Expected lake manifest artifacts to be an array");
  }
  if (createdAt !== undefined && createdAt !== null && typeof createdAt !== "string") {
    throw new Error("Expected lake manifest createdAt to be a string when present");
  }

  return {
    artifacts: artifacts.map((artifact) => decodeLakeManifestArtifactRecord(artifact)),
    createdAt: createdAt ?? null,
  };
}

function prepareBatchArtifactLayout(layout: BatchRunArtifactLayout): void {
  ensureDirectory(layout.snapshotRoot);
  ensureDirectory(layout.runDir);
  ensureDirectory(layout.lakeDatasetRoot);
  ensureDirectory(layout.duckdbDatasetRoot);
  ensureDirectory(layout.silverPlainDir);
  ensureDirectory(layout.silverSpatialDir);
  ensureDirectory(layout.goldPlainDir);
  ensureDirectory(layout.goldSpatialDir);
  ensureDirectory(layout.runDuckDbDir);
  ensureDirectory(layout.qaDir);
  ensureDirectory(layout.manifestsDir);
  writeDuckDbBootstrapSql(layout.runDuckDbBootstrapPath);
}

function buildLakeManifestArtifactKey(artifact: LakeManifestArtifactRecord): string {
  return `${artifact.phase}:${artifact.layer}:${artifact.relativePath}`;
}

function mergeArtifactRecords(
  existing: readonly LakeManifestArtifactRecord[],
  additions: readonly LakeManifestArtifactRecord[]
): readonly LakeManifestArtifactRecord[] {
  const merged = new Map<string, LakeManifestArtifactRecord>();

  for (const artifact of existing) {
    merged.set(buildLakeManifestArtifactKey(artifact), artifact);
  }
  for (const artifact of additions) {
    merged.set(buildLakeManifestArtifactKey(artifact), artifact);
  }

  return [...merged.values()].sort((left, right) =>
    buildLakeManifestArtifactKey(left).localeCompare(buildLakeManifestArtifactKey(right))
  );
}

export function resolveBatchArtifactLayout(args: {
  readonly dataset: BatchArtifactDataset;
  readonly env?: NodeJS.ProcessEnv;
  readonly projectRoot: string;
  readonly runId: string;
  readonly snapshotRoot?: string;
}): BatchRunArtifactLayout {
  const env = args.env ?? process.env;
  const snapshotRoot = resolve(
    args.projectRoot,
    args.snapshotRoot ?? defaultSnapshotRootForDataset(args.dataset, env)
  );
  const runDir = join(snapshotRoot, args.runId);
  const silverDir = join(runDir, "silver");
  const goldDir = join(runDir, "gold");
  const runDuckDbDir = join(runDir, "duckdb");
  const qaDir = join(runDir, "qa");
  const manifestsDir = join(runDir, "manifests");

  return {
    dataset: args.dataset,
    duckdbDatasetRoot: resolve(args.projectRoot, defaultDuckDbDatasetRoot(args.dataset, env)),
    goldDir,
    goldPlainDir: join(goldDir, "plain"),
    goldSpatialDir: join(goldDir, "spatial"),
    lakeDatasetRoot: resolve(args.projectRoot, defaultLakeDatasetRoot(args.dataset, env)),
    lakeManifestPath: join(manifestsDir, "lake-manifest.json"),
    manifestsDir,
    qaAssertionsPath: join(qaDir, "assertions.parquet"),
    qaDir,
    qaProfilePath: join(qaDir, "profile.parquet"),
    runDir,
    runDuckDbBootstrapPath: join(runDuckDbDir, "bootstrap.sql"),
    runDuckDbDir,
    runDuckDbPath: join(runDuckDbDir, "run.duckdb"),
    runId: args.runId,
    silverDir,
    silverPlainDir: join(silverDir, "plain"),
    silverSpatialDir: join(silverDir, "spatial"),
    snapshotRoot,
  };
}

export function createLakeManifestRecord(args: CreateLakeManifestRecordInput): LakeManifestRecord {
  return {
    artifacts: args.artifacts ?? [],
    createdAt: args.createdAt ?? new Date().toISOString(),
    dataset: args.layout.dataset,
    datasetConvention: DATASET_LAKE_CONVENTIONS[args.layout.dataset],
    dataVersion: args.dataVersion ?? null,
    duckdb: {
      bootstrapSqlPath: args.layout.runDuckDbBootstrapPath,
      databasePath: args.layout.runDuckDbPath,
      requiredExtensions: DEFAULT_DUCKDB_BOOTSTRAP_EXTENSIONS,
    },
    effectiveDate: args.effectiveDate ?? null,
    manifestVersion: "lake-manifest-v1",
    month: args.month ?? null,
    paths: {
      duckdbDatasetRoot: args.layout.duckdbDatasetRoot,
      goldPlainDir: args.layout.goldPlainDir,
      goldSpatialDir: args.layout.goldSpatialDir,
      lakeDatasetRoot: args.layout.lakeDatasetRoot,
      qaAssertionsPath: args.layout.qaAssertionsPath,
      qaProfilePath: args.layout.qaProfilePath,
      runDir: args.layout.runDir,
      silverPlainDir: args.layout.silverPlainDir,
      silverSpatialDir: args.layout.silverSpatialDir,
      snapshotRoot: args.layout.snapshotRoot,
    },
    runId: args.layout.runId,
    standards: {
      bboxColumns: DEFAULT_BBOX_COLUMNS,
      canonicalWebMercatorStorage: false,
      compressionCodec: "zstd",
      geometryColumn: "geom",
      geometryCrs: "EPSG:4326",
      geoParquetCrs: "OGC:CRS84",
      hiveStylePartitioning: true,
      manifestControlSurface: "json",
      parquetKeyValueMetadata: "optional",
      recommendedRowGroupSizeRange: {
        maximum: 1_000_000,
        minimum: 100_000,
      },
      requiredProvenanceFields: DEFAULT_PROVENANCE_FIELDS,
    },
  };
}

export function resolveDatasetLakeConvention(
  dataset: BatchArtifactDataset
): DatasetLakeConventionRecord {
  return DATASET_LAKE_CONVENTIONS[dataset];
}

export function ensureBatchArtifactLayout(args: CreateLakeManifestRecordInput): LakeManifestRecord {
  const manifest = createLakeManifestRecord(args);

  prepareBatchArtifactLayout(args.layout);
  writeJsonAtomic(args.layout.lakeManifestPath, manifest);

  return manifest;
}

export function mergeLakeManifestArtifacts(
  args: CreateLakeManifestRecordInput
): LakeManifestRecord {
  prepareBatchArtifactLayout(args.layout);

  const existingManifest =
    readJsonOption(args.layout.lakeManifestPath, decodeExistingLakeManifestRecord) ??
    createLakeManifestRecord({
      layout: args.layout,
      ...(args.dataVersion === undefined ? {} : { dataVersion: args.dataVersion }),
      ...(args.effectiveDate === undefined ? {} : { effectiveDate: args.effectiveDate }),
      ...(args.month === undefined ? {} : { month: args.month }),
    });
  const manifest = createLakeManifestRecord({
    ...args,
    artifacts: mergeArtifactRecords(existingManifest.artifacts, args.artifacts ?? []),
    ...(existingManifest.createdAt === null ? {} : { createdAt: existingManifest.createdAt }),
  });

  writeJsonAtomic(args.layout.lakeManifestPath, manifest);
  return manifest;
}

export function resolveBatchArtifactLayoutFromFileUrl(args: {
  readonly dataset: BatchArtifactDataset;
  readonly env?: NodeJS.ProcessEnv;
  readonly fileUrl: string;
  readonly levelsUp: number;
  readonly runId: string;
  readonly snapshotRoot?: string;
}): BatchRunArtifactLayout {
  return resolveBatchArtifactLayout({
    dataset: args.dataset,
    projectRoot: resolveProjectRootFromFileUrl(args.fileUrl, args.levelsUp),
    runId: args.runId,
    ...(args.env === undefined ? {} : { env: args.env }),
    ...(args.snapshotRoot === undefined ? {} : { snapshotRoot: args.snapshotRoot }),
  });
}
