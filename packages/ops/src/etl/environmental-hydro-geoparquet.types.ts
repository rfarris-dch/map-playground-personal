import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";

export type HydroCanonicalGeoParquetFeatureKind = "label" | "line" | "polygon";

export type HydroCanonicalGeoParquetHucLevel = 4 | 6 | 8 | 10 | 12;

export interface HydroCanonicalGeoParquetContext {
  readonly lakeDatasetRoot: string;
  readonly runDir: string;
  readonly runDuckDbBootstrapPath: string;
  readonly runDuckDbPath: string;
}

export interface HydroCanonicalGeoParquetOutput {
  readonly featureKind: HydroCanonicalGeoParquetFeatureKind;
  readonly hucLevel: HydroCanonicalGeoParquetHucLevel;
  readonly outputPath: string;
}

export interface HydroCanonicalGeoParquetArtifactSpec {
  readonly artifact: LakeManifestArtifactRecord;
  readonly outputs: readonly HydroCanonicalGeoParquetOutput[];
  readonly publishedVersionRootPath: string;
  readonly stageVersionRootPath: string;
}

export interface HydroCanonicalGeoParquetCount {
  readonly featureKind: HydroCanonicalGeoParquetFeatureKind;
  readonly hucLevel: HydroCanonicalGeoParquetHucLevel;
  readonly rowCount: number;
}

export interface HydroCanonicalGeoParquetValidationRow {
  readonly feature_kind: HydroCanonicalGeoParquetFeatureKind;
  readonly geometry_type: string;
  readonly huc_level: HydroCanonicalGeoParquetHucLevel;
  readonly max_geom_xmax: number | null;
  readonly max_xmax: number | null;
  readonly min_geom_xmin: number | null;
  readonly min_xmin: number | null;
  readonly null_geom_count: number;
  readonly row_count: number;
}

export interface HydroCanonicalGeoParquetResult {
  readonly artifact: LakeManifestArtifactRecord;
  readonly counts: readonly HydroCanonicalGeoParquetCount[];
  readonly publishedVersionRootPath: string;
}

export interface HydroCanonicalGeoParquetWriteArgs {
  readonly context: HydroCanonicalGeoParquetContext;
  readonly databaseUrl: string;
  readonly dataVersion: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly runId: string;
}
