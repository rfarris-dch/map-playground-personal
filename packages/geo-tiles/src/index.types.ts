export interface TileDecodeFailure {
  readonly message: string;
  readonly ok: false;
}

export interface TileDecodeSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export type TileDecodeResult<T> = TileDecodeFailure | TileDecodeSuccess<T>;

export interface TilePublishManifest {
  current: TileManifestEntry;
  dataset: TileDataset;
  previous: TileManifestEntry | null;
  publishedAt: string;
}

export interface VectorTilesetSchemaContract {
  readonly dataset: TileDataset;
  readonly featureIdProperty: string;
  readonly sourceLayer: string;
}

export interface TileManifestEntry {
  checksum: string;
  dataset: TileDataset;
  ingestionRunId?: string;
  url: string;
  version: string;
}

export type TileDataset =
  | "parcels"
  | "parcels-draw-v1"
  | "parcels-analysis-v1"
  | "environmental-flood"
  | "environmental-hydro-basins"
  | "gas-pipelines-v1"
  | "infrastructure"
  | "power"
  | "telecom";
