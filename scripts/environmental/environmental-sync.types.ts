export type EnvironmentalDataset = "environmental-flood" | "environmental-hydro-basins";

export type EnvironmentalSyncStep = "extract" | "normalize";

export interface EnvironmentalRunContext {
  readonly dataset: EnvironmentalDataset;
  readonly datasetRoot: string;
  readonly latestRunPointerPath: string;
  readonly normalizedDir: string;
  readonly publishCompletePath: string;
  readonly rawDir: string;
  readonly runConfigPath: string;
  readonly runDir: string;
  readonly runId: string;
  readonly runSummaryPath: string;
}

export interface GeoJsonFeature {
  readonly geometry: unknown;
  readonly properties: Readonly<Record<string, unknown>> | null;
  readonly type: "Feature";
}

export interface GeoJsonFeatureCollection {
  readonly features: readonly GeoJsonFeature[];
  readonly type: "FeatureCollection";
}

export interface LineStringGeometry {
  readonly coordinates: readonly Position[];
  readonly type: "LineString";
}

export interface PointGeometry {
  readonly coordinates: Position;
  readonly type: "Point";
}

export type Position = readonly [number, number];

export interface RunConfigRecord {
  readonly createdAt: string;
  readonly dataset: EnvironmentalDataset;
  readonly dataVersion: string;
  readonly options: Readonly<Record<string, string>>;
  readonly runId: string;
  readonly sourcePath?: string;
  readonly sourceUrl?: string;
}

export interface SourceMaterializationResult {
  readonly localPath: string;
  readonly sourcePath: string | null;
  readonly sourceUrl: string | null;
}
