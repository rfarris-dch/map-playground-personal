import type { LakeManifestArtifactRecord } from "./batch-artifact-layout.types";

export type FloodCanonicalGeoParquetBand = "100" | "500" | "full";

export interface FloodCanonicalGeoParquetContext {
  readonly lakeDatasetRoot: string;
  readonly runDir: string;
  readonly runDuckDbBootstrapPath: string;
  readonly runDuckDbPath: string;
}

export interface FloodCanonicalGeoParquetBandOutput {
  readonly band: FloodCanonicalGeoParquetBand;
  readonly outputPath: string;
}

export interface FloodCanonicalGeoParquetArtifactSpec {
  readonly artifact: LakeManifestArtifactRecord;
  readonly bandOutputs: readonly FloodCanonicalGeoParquetBandOutput[];
  readonly publishedVersionRootPath: string;
  readonly stageVersionRootPath: string;
}

export interface FloodCanonicalGeoParquetValidationCounts {
  readonly "100": number;
  readonly "500": number;
  readonly full: number;
}

export interface FloodCanonicalGeoParquetValidationRow {
  readonly flood_band: FloodCanonicalGeoParquetBand;
  readonly geometry_type: string;
  readonly max_geom_xmax: number | null;
  readonly max_xmax: number | null;
  readonly min_geom_xmin: number | null;
  readonly min_xmin: number | null;
  readonly null_geom_count: number;
  readonly row_count: number;
}

export interface FloodCanonicalGeoParquetResult {
  readonly artifact: LakeManifestArtifactRecord;
  readonly counts: FloodCanonicalGeoParquetValidationCounts;
  readonly publishedVersionRootPath: string;
}

export interface FloodCanonicalGeoParquetWriteArgs {
  readonly context: FloodCanonicalGeoParquetContext;
  readonly databaseUrl: string;
  readonly dataVersion: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly expectedCounts?: FloodCanonicalGeoParquetValidationCounts;
  readonly runId: string;
}
