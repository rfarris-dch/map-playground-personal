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
  | "infrastructure"
  | "power"
  | "telecom";
