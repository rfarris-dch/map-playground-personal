import type {
  TileDataset,
  TileDecodeResult,
  TileManifestEntry,
  TilePublishManifest,
} from "./index.types";

export type {
  TileDataset,
  TileDecodeFailure,
  TileDecodeResult,
  TileDecodeSuccess,
  TileManifestEntry,
  TilePublishManifest,
  VectorTilesetSchemaContract,
} from "./index.types";

function decodeSuccess<T>(value: T): TileDecodeResult<T> {
  return { ok: true, value };
}

function decodeFailure(message: string): TileDecodeResult<never> {
  return { message, ok: false };
}

function unwrapTileDecodeResult<T>(result: TileDecodeResult<T>): T {
  if (result.ok) {
    return result.value;
  }

  throw new Error(result.message);
}

export function decodeTileDataset(value: string): TileDataset | null {
  switch (value) {
    case "parcels":
    case "parcels-draw-v1":
    case "parcels-analysis-v1":
    case "environmental-flood":
    case "environmental-hydro-basins":
    case "infrastructure":
    case "power":
    case "telecom":
      return value;
    default:
      return null;
  }
}

export function parseTileDataset(value: string): TileDataset | null {
  return decodeTileDataset(value);
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

export function decodeTileManifestEntry(value: unknown): TileDecodeResult<TileManifestEntry> {
  if (!isRecord(value)) {
    return decodeFailure("Invalid tile manifest entry: expected object");
  }

  let rawDataset: string;
  try {
    rawDataset = readRequiredString(value, "dataset", "tile manifest entry");
  } catch (error) {
    return decodeFailure(error instanceof Error ? error.message : String(error));
  }

  const dataset = decodeTileDataset(rawDataset);
  if (dataset === null) {
    return decodeFailure(`Invalid tile manifest entry: unsupported dataset "${rawDataset}"`);
  }

  let entry: TileManifestEntry;
  try {
    entry = {
      dataset,
      version: readRequiredString(value, "version", "tile manifest entry"),
      checksum: readRequiredString(value, "checksum", "tile manifest entry"),
      url: readRequiredString(value, "url", "tile manifest entry"),
    };
  } catch (error) {
    return decodeFailure(error instanceof Error ? error.message : String(error));
  }

  const ingestionRunId = readOptionalTrimmedString(value, "ingestionRunId");
  if (typeof ingestionRunId === "string") {
    entry.ingestionRunId = ingestionRunId;
  }

  return decodeSuccess(entry);
}

export function parseTileManifestEntry(value: unknown): TileManifestEntry {
  return unwrapTileDecodeResult(decodeTileManifestEntry(value));
}

export function decodeTilePublishManifest(value: unknown): TileDecodeResult<TilePublishManifest> {
  if (!isRecord(value)) {
    return decodeFailure("Invalid tile publish manifest: expected object");
  }

  let rawDataset: string;
  try {
    rawDataset = readRequiredString(value, "dataset", "tile publish manifest");
  } catch (error) {
    return decodeFailure(error instanceof Error ? error.message : String(error));
  }

  const dataset = decodeTileDataset(rawDataset);
  if (dataset === null) {
    return decodeFailure(`Invalid tile publish manifest: unsupported dataset "${rawDataset}"`);
  }

  const previousRaw = Reflect.get(value, "previous");
  let previous: TileManifestEntry | null = null;
  if (previousRaw !== null && typeof previousRaw !== "undefined") {
    const decodedPrevious = decodeTileManifestEntry(previousRaw);
    if (!decodedPrevious.ok) {
      return decodedPrevious;
    }

    previous = decodedPrevious.value;
  }

  let publishedAt: string;
  try {
    publishedAt = readRequiredString(value, "publishedAt", "tile publish manifest");
  } catch (error) {
    return decodeFailure(error instanceof Error ? error.message : String(error));
  }

  const decodedCurrent = decodeTileManifestEntry(Reflect.get(value, "current"));
  if (!decodedCurrent.ok) {
    return decodedCurrent;
  }

  const manifest: TilePublishManifest = {
    dataset,
    publishedAt,
    current: decodedCurrent.value,
    previous,
  };

  try {
    assertTileManifestMatchesDataset(manifest, manifest.dataset, "tile publish manifest");
    return decodeSuccess(manifest);
  } catch (error) {
    return decodeFailure(error instanceof Error ? error.message : String(error));
  }
}

export function parseTilePublishManifest(value: unknown): TilePublishManifest {
  return unwrapTileDecodeResult(decodeTilePublishManifest(value));
}

export function assertTileManifestMatchesDataset(
  manifest: TilePublishManifest,
  expectedDataset: TileDataset,
  context: string
): void {
  if (manifest.dataset !== expectedDataset) {
    throw new Error(
      `Invalid ${context}: expected manifest dataset "${expectedDataset}" but received "${manifest.dataset}"`
    );
  }

  if (manifest.current.dataset !== expectedDataset) {
    throw new Error(
      `Invalid ${context}: expected current manifest dataset "${expectedDataset}" but received "${manifest.current.dataset}"`
    );
  }

  const previous = manifest.previous;
  if (previous !== null && previous.dataset !== expectedDataset) {
    throw new Error(
      `Invalid ${context}: expected previous manifest dataset "${expectedDataset}" but received "${previous.dataset}"`
    );
  }
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

export function normalizeManifestPath(manifestPath: string): string {
  if (manifestPath.startsWith("http://") || manifestPath.startsWith("https://")) {
    return manifestPath;
  }

  if (manifestPath.startsWith("/")) {
    return manifestPath;
  }

  return `/${manifestPath}`;
}

function resolveLocationOrigin(locationOrigin: string | undefined): string {
  if (typeof locationOrigin === "string") {
    return locationOrigin;
  }

  return window.location.origin;
}

export function normalizePmtilesAssetUrl(assetUrl: string, locationOrigin?: string): string {
  if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
    return assetUrl;
  }

  const normalizedPath = assetUrl.startsWith("/") ? assetUrl : `/${assetUrl}`;
  return `${resolveLocationOrigin(locationOrigin)}${normalizedPath}`;
}

export function createPmtilesSourceUrl(
  manifest: TilePublishManifest,
  locationOrigin?: string
): string {
  const absoluteAssetUrl = normalizePmtilesAssetUrl(manifest.current.url, locationOrigin);
  return `pmtiles://${absoluteAssetUrl}`;
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
  const manifest: TilePublishManifest = {
    dataset,
    current,
    previous,
    publishedAt: new Date().toISOString(),
  };

  assertTileManifestMatchesDataset(manifest, dataset, "tile publish manifest");

  return manifest;
}
