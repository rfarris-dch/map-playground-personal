import type { TileDataset, TileManifestEntry, TilePublishManifest } from "./index.types";

export type { TileDataset, TileManifestEntry, TilePublishManifest } from "./index.types";

export function parseTileDataset(value: string): TileDataset | null {
  switch (value) {
    case "parcels":
    case "parcels-draw-v1":
    case "parcels-analysis-v1":
    case "infrastructure":
    case "power":
    case "telecom":
      return value;
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = Reflect.get(record, key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${context}: missing required string field "${key}"`);
  }

  return value;
}

function readOptionalTrimmedString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = Reflect.get(record, key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

export function parseTileManifestEntry(value: unknown): TileManifestEntry {
  if (!isRecord(value)) {
    throw new Error("Invalid tile manifest entry: expected object");
  }

  const rawDataset = readRequiredString(value, "dataset", "tile manifest entry");
  const dataset = parseTileDataset(rawDataset);
  if (dataset === null) {
    throw new Error(`Invalid tile manifest entry: unsupported dataset "${rawDataset}"`);
  }

  const entry: TileManifestEntry = {
    dataset,
    version: readRequiredString(value, "version", "tile manifest entry"),
    checksum: readRequiredString(value, "checksum", "tile manifest entry"),
    url: readRequiredString(value, "url", "tile manifest entry"),
  };

  const ingestionRunId = readOptionalTrimmedString(value, "ingestionRunId");
  if (typeof ingestionRunId === "string") {
    entry.ingestionRunId = ingestionRunId;
  }

  return entry;
}

export function parseTilePublishManifest(value: unknown): TilePublishManifest {
  if (!isRecord(value)) {
    throw new Error("Invalid tile publish manifest: expected object");
  }

  const rawDataset = readRequiredString(value, "dataset", "tile publish manifest");
  const dataset = parseTileDataset(rawDataset);
  if (dataset === null) {
    throw new Error(`Invalid tile publish manifest: unsupported dataset "${rawDataset}"`);
  }

  const previousRaw = Reflect.get(value, "previous");
  let previous: TileManifestEntry | null = null;
  if (previousRaw !== null && typeof previousRaw !== "undefined") {
    previous = parseTileManifestEntry(previousRaw);
  }

  return {
    dataset,
    publishedAt: readRequiredString(value, "publishedAt", "tile publish manifest"),
    current: parseTileManifestEntry(Reflect.get(value, "current")),
    previous,
  };
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
