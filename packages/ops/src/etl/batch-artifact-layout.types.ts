export type BatchArtifactDataset =
  | "boundaries"
  | "county-power"
  | "environmental-flood"
  | "environmental-hydro-basins"
  | "market-boundaries"
  | "parcels";

export type BatchArtifactFormat = "geoparquet" | "parquet";

export type BatchArtifactPhase =
  | "gold-plain"
  | "gold-spatial"
  | "lake-plain"
  | "lake-spatial"
  | "qa-plain"
  | "silver-plain"
  | "silver-spatial";

export type DuckDbRequiredExtension = "httpfs" | "postgres" | "spatial";

export type DatasetConventionPhase = "gold" | "lake" | "qa" | "silver";

export type LakeManifestVersion = "lake-manifest-v1";

export interface BatchRunArtifactLayout {
  readonly dataset: BatchArtifactDataset;
  readonly duckdbDatasetRoot: string;
  readonly goldDir: string;
  readonly goldPlainDir: string;
  readonly goldSpatialDir: string;
  readonly lakeDatasetRoot: string;
  readonly lakeManifestPath: string;
  readonly manifestsDir: string;
  readonly qaAssertionsPath: string;
  readonly qaDir: string;
  readonly qaProfilePath: string;
  readonly runDir: string;
  readonly runDuckDbBootstrapPath: string;
  readonly runDuckDbDir: string;
  readonly runDuckDbPath: string;
  readonly runId: string;
  readonly silverDir: string;
  readonly silverPlainDir: string;
  readonly silverSpatialDir: string;
  readonly snapshotRoot: string;
}

export interface LakeManifestPathsRecord {
  readonly duckdbDatasetRoot: string;
  readonly goldPlainDir: string;
  readonly goldSpatialDir: string;
  readonly lakeDatasetRoot: string;
  readonly qaAssertionsPath: string;
  readonly qaProfilePath: string;
  readonly runDir: string;
  readonly silverPlainDir: string;
  readonly silverSpatialDir: string;
  readonly snapshotRoot: string;
}

export interface LakeManifestStandardsRecord {
  readonly bboxColumns: readonly string[];
  readonly canonicalWebMercatorStorage: false;
  readonly compressionCodec: "zstd";
  readonly geometryColumn: "geom";
  readonly geometryCrs: "EPSG:4326";
  readonly geoParquetCrs: "OGC:CRS84";
  readonly hiveStylePartitioning: true;
  readonly manifestControlSurface: "json";
  readonly parquetKeyValueMetadata: "optional";
  readonly recommendedRowGroupSizeRange: {
    readonly maximum: number;
    readonly minimum: number;
  };
  readonly requiredProvenanceFields: readonly string[];
}

export interface DatasetPartitionConventionRecord {
  readonly artifactFamily: string;
  readonly description: string;
  readonly format: BatchArtifactFormat;
  readonly partitionKeys: readonly string[];
  readonly phase: DatasetConventionPhase;
  readonly relativeLayoutTemplate: string;
}

export interface DatasetLakeConventionRecord {
  readonly dataset: BatchArtifactDataset;
  readonly notes: readonly string[];
  readonly partitionRules: readonly DatasetPartitionConventionRecord[];
}

export interface LakeManifestDuckDbRecord {
  readonly bootstrapSqlPath: string;
  readonly databasePath: string;
  readonly requiredExtensions: readonly DuckDbRequiredExtension[];
}

export interface LakeManifestArtifactRecord {
  readonly format: BatchArtifactFormat;
  readonly layer: string;
  readonly partitionKeys: readonly string[];
  readonly phase: BatchArtifactPhase;
  readonly relativePath: string;
}

export interface LakeManifestRecord {
  readonly artifacts: readonly LakeManifestArtifactRecord[];
  readonly createdAt: string;
  readonly dataset: BatchArtifactDataset;
  readonly datasetConvention: DatasetLakeConventionRecord;
  readonly dataVersion: string | null;
  readonly duckdb: LakeManifestDuckDbRecord;
  readonly effectiveDate: string | null;
  readonly manifestVersion: LakeManifestVersion;
  readonly month: string | null;
  readonly paths: LakeManifestPathsRecord;
  readonly runId: string;
  readonly standards: LakeManifestStandardsRecord;
}

export interface CreateLakeManifestRecordInput {
  readonly artifacts?: readonly LakeManifestArtifactRecord[];
  readonly createdAt?: string;
  readonly dataVersion?: string | null;
  readonly effectiveDate?: string | null;
  readonly layout: BatchRunArtifactLayout;
  readonly month?: string | null;
}
