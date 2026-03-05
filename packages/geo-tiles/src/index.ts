export type TileDataset =
  | "parcels"
  | "parcels-draw-v1"
  | "parcels-analysis-v1"
  | "infrastructure"
  | "power"
  | "telecom";

export interface TileManifestEntry {
  checksum: string;
  dataset: TileDataset;
  ingestionRunId?: string;
  url: string;
  version: string;
}

export interface TilePublishManifest {
  current: TileManifestEntry;
  dataset: TileDataset;
  previous: TileManifestEntry | null;
  publishedAt: string;
}

export function createTileVersion(date: Date, checksum: string): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}.${checksum.slice(0, 8)}`;
}

export function buildPmtilesPath(dataset: TileDataset, version: string): string {
  return `/tiles/${dataset}/${version}.pmtiles`;
}

export function buildTileLatestManifestPath(dataset: TileDataset): string {
  return `/tiles/${dataset}/latest.json`;
}

export function createManifestEntry(
  dataset: TileDataset,
  date: Date,
  checksum: string,
  options: { readonly ingestionRunId?: string } = {}
): TileManifestEntry {
  const version = createTileVersion(date, checksum);
  const nextEntry: TileManifestEntry = {
    dataset,
    version,
    checksum,
    url: buildPmtilesPath(dataset, version),
  };

  if (typeof options.ingestionRunId === "string" && options.ingestionRunId.trim().length > 0) {
    nextEntry.ingestionRunId = options.ingestionRunId.trim();
  }

  return nextEntry;
}

export function createPublishManifest(
  dataset: TileDataset,
  current: TileManifestEntry,
  previous: TileManifestEntry | null
): TilePublishManifest {
  return {
    dataset,
    current,
    previous,
    publishedAt: new Date().toISOString(),
  };
}
