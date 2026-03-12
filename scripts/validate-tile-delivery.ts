#!/usr/bin/env bun
import {
  assertTileManifestMatchesDataset,
  buildTileLatestManifestPath,
  normalizePmtilesAssetUrl,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
} from "@map-migration/geo-tiles";
import { findCliArgValue, trimToNull } from "@map-migration/ops/etl/cli-config";

const DEFAULT_MANIFEST_CACHE_CONTROL = "public,max-age=60";
const DEFAULT_PMTILES_CACHE_CONTROL = "public,max-age=31536000,immutable";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const PMTILES_RANGE_HEADER = "bytes=0-0";

interface CliArgs {
  readonly allowHttp: boolean;
  readonly dataset: TileDataset;
  readonly expectedManifestCacheControl: string;
  readonly expectedPmtilesCacheControl: string;
  readonly manifestUrl: string;
  readonly requestTimeoutMs: number;
}

export interface TileDeliveryValidationArgs extends CliArgs {}

export interface TileDeliveryValidationSuccess {
  readonly dataset: TileDataset;
  readonly manifestUrl: string;
  readonly pmtilesUrl: string;
}

function parseDataset(raw: string | null): TileDataset {
  if (typeof raw === "string") {
    const parsed = parseTileDataset(raw);
    if (parsed !== null) {
      return parsed;
    }
  }

  throw new Error(
    "Missing or invalid --dataset. Expected one of: parcels, parcels-draw-v1, parcels-analysis-v1, environmental-flood, environmental-hydro-basins, infrastructure, power, telecom"
  );
}

function parsePositiveIntArg(name: string, raw: string | null, fallback: number): number {
  if (raw === null) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer (received "${raw}")`);
  }

  return Math.floor(parsed);
}

function parseCliArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const manifestUrl = trimToNull(findCliArgValue(argv, "manifest-url"));
  if (manifestUrl === null) {
    throw new Error("--manifest-url is required");
  }

  const allowHttp = trimToNull(findCliArgValue(argv, "allow-http")) === "1";

  return {
    allowHttp,
    dataset: parseDataset(findCliArgValue(argv, "dataset")),
    expectedManifestCacheControl:
      trimToNull(findCliArgValue(argv, "expected-manifest-cache-control")) ??
      DEFAULT_MANIFEST_CACHE_CONTROL,
    expectedPmtilesCacheControl:
      trimToNull(findCliArgValue(argv, "expected-pmtiles-cache-control")) ??
      DEFAULT_PMTILES_CACHE_CONTROL,
    manifestUrl,
    requestTimeoutMs: parsePositiveIntArg(
      "--request-timeout-ms",
      findCliArgValue(argv, "request-timeout-ms"),
      DEFAULT_REQUEST_TIMEOUT_MS
    ),
  };
}

export function parseCacheControlDirectives(rawHeader: string | null): readonly string[] {
  if (typeof rawHeader !== "string") {
    return [];
  }

  return rawHeader
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .filter((directive) => directive.length > 0);
}

export function assertCacheControlContract(
  label: string,
  rawHeader: string | null,
  expectedContract: string
): void {
  const actualDirectives = new Set(parseCacheControlDirectives(rawHeader));
  const expectedDirectives = parseCacheControlDirectives(expectedContract);
  if (expectedDirectives.length === 0) {
    throw new Error(`${label} contract must include at least one Cache-Control directive`);
  }

  if (actualDirectives.size === 0) {
    throw new Error(`${label} is missing a Cache-Control header`);
  }

  for (const directive of expectedDirectives) {
    if (!actualDirectives.has(directive)) {
      throw new Error(
        `${label} must include Cache-Control directive "${directive}" (received "${rawHeader ?? ""}")`
      );
    }
  }
}

function assertHttpsUrl(url: URL, label: string, allowHttp: boolean): void {
  if (url.protocol === "https:") {
    return;
  }

  if (allowHttp && url.protocol === "http:") {
    return;
  }

  throw new Error(`${label} must use ${allowHttp ? "http/https" : "https"} (received "${url}")`);
}

function parseAbsoluteUrl(value: string, label: string, allowHttp: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL (received "${value}")`);
  }

  assertHttpsUrl(url, label, allowHttp);
  return url.toString();
}

export function assertManifestUrlShape(manifestUrl: string, dataset: TileDataset): void {
  const url = new URL(manifestUrl);
  const expectedPath = buildTileLatestManifestPath(dataset);
  if (!url.pathname.endsWith(expectedPath)) {
    throw new Error(
      `manifest URL must end with "${expectedPath}" for dataset "${dataset}" (received "${manifestUrl}")`
    );
  }
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true }
  );
  return controller.signal;
}

async function fetchResponse(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    throw new Error(
      `[tiles] request failed for ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function fetchManifest(
  dataset: TileDataset,
  manifestUrl: string,
  expectedManifestCacheControl: string,
  requestTimeoutMs: number
) {
  const response = await fetchResponse(
    manifestUrl,
    {
      headers: {
        accept: "application/json",
      },
      method: "GET",
    },
    requestTimeoutMs
  );

  if (!response.ok) {
    throw new Error(`[tiles] manifest request failed (${response.status}) for ${manifestUrl}`);
  }

  assertCacheControlContract(
    "tile manifest response",
    response.headers.get("cache-control"),
    expectedManifestCacheControl
  );

  let manifest: unknown;
  try {
    manifest = JSON.parse(await response.text());
  } catch (error) {
    throw new Error(
      `[tiles] manifest response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const parsedManifest = parseTilePublishManifest(manifest);
  assertTileManifestMatchesDataset(parsedManifest, dataset, "tile delivery validation");
  return parsedManifest;
}

function assertPmtilesDeliveryHeaders(
  response: Response,
  expectedPmtilesCacheControl: string
): void {
  if (response.status !== 206) {
    throw new Error(
      `[tiles] PMTiles range request must return 206 Partial Content (received ${response.status})`
    );
  }

  const contentRange = trimToNull(response.headers.get("content-range"))?.toLowerCase() ?? "";
  if (!contentRange.startsWith("bytes 0-0/")) {
    throw new Error(
      `[tiles] PMTiles range request must return Content-Range for bytes 0-0 (received "${response.headers.get("content-range") ?? ""}")`
    );
  }

  const acceptRanges = trimToNull(response.headers.get("accept-ranges"))?.toLowerCase() ?? "";
  if (acceptRanges.length > 0 && !acceptRanges.includes("bytes")) {
    throw new Error(
      `[tiles] PMTiles response must advertise byte ranges when Accept-Ranges is present (received "${response.headers.get("accept-ranges") ?? ""}")`
    );
  }

  assertCacheControlContract(
    "pmtiles response",
    response.headers.get("cache-control"),
    expectedPmtilesCacheControl
  );

  const contentEncoding = trimToNull(response.headers.get("content-encoding"));
  if (typeof contentEncoding === "string" && contentEncoding.toLowerCase() !== "identity") {
    throw new Error(
      `[tiles] PMTiles response must not use content-encoding (received "${contentEncoding}")`
    );
  }
}

async function validatePmtilesResponse(
  manifestUrl: string,
  pmtilesAssetUrl: string,
  expectedPmtilesCacheControl: string,
  allowHttp: boolean,
  requestTimeoutMs: number
): Promise<string> {
  const pmtilesUrl = parseAbsoluteUrl(
    normalizePmtilesAssetUrl(pmtilesAssetUrl, manifestUrl),
    "PMTiles URL",
    allowHttp
  );
  const response = await fetchResponse(
    pmtilesUrl,
    {
      headers: {
        range: PMTILES_RANGE_HEADER,
      },
      method: "GET",
    },
    requestTimeoutMs
  );

  assertPmtilesDeliveryHeaders(response, expectedPmtilesCacheControl);
  await response.arrayBuffer();
  return pmtilesUrl;
}

export async function validateTileDelivery(
  args: TileDeliveryValidationArgs
): Promise<TileDeliveryValidationSuccess> {
  const manifestUrl = parseAbsoluteUrl(args.manifestUrl, "manifest URL", args.allowHttp);
  assertManifestUrlShape(manifestUrl, args.dataset);

  const manifest = await fetchManifest(
    args.dataset,
    manifestUrl,
    args.expectedManifestCacheControl,
    args.requestTimeoutMs
  );
  const pmtilesUrl = await validatePmtilesResponse(
    manifestUrl,
    manifest.current.url,
    args.expectedPmtilesCacheControl,
    args.allowHttp,
    args.requestTimeoutMs
  );

  return {
    dataset: args.dataset,
    manifestUrl,
    pmtilesUrl,
  };
}

async function main(): Promise<void> {
  const result = await validateTileDelivery(parseCliArgs());
  console.log("[tiles] delivery validation passed");
  console.log(`dataset=${result.dataset}`);
  console.log(`manifest=${result.manifestUrl}`);
  console.log(`pmtiles=${result.pmtilesUrl}`);
}

if (import.meta.main) {
  await main();
}
