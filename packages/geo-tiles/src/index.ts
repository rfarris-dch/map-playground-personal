export type TileDataset = "parcels" | "infrastructure" | "power" | "telecom";

export interface TileManifestEntry {
  checksum: string;
  dataset: TileDataset;
  url: string;
  version: string;
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

export function createManifestEntry(
  dataset: TileDataset,
  date: Date,
  checksum: string
): TileManifestEntry {
  const version = createTileVersion(date, checksum);
  return {
    dataset,
    version,
    checksum,
    url: buildPmtilesPath(dataset, version),
  };
}
