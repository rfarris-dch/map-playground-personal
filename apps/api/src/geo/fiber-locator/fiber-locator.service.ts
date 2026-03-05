import { type BBox, type FiberLocatorLayer, formatBboxParam } from "@map-migration/contracts";
import type {
  FiberLocatorCatalogResult,
  FiberLocatorConfig,
  FiberLocatorLayersInViewResult,
  FiberLocatorTileRequest,
  FiberLocatorUpstreamLayer,
} from "./fiber-locator.types";

interface FetchWithTimeoutResult {
  readonly response: Response;
}

interface FiberLocatorTileSnapshot {
  readonly body: Uint8Array;
  readonly cachedAtMs: number;
  readonly headers: Headers;
  readonly status: number;
  readonly statusText: string;
}

const FIBER_LOCATOR_TILE_RETRY_MAX_ATTEMPTS = 3;
const FIBER_LOCATOR_TILE_RETRY_BASE_DELAY_MS = 250;
const FIBER_LOCATOR_TILE_CACHE_TTL_MS = 15_000;
const FIBER_LOCATOR_TILE_CACHE_MAX_ENTRIES = 512;

const tileSnapshotByKey = new Map<string, FiberLocatorTileSnapshot>();
const tileSnapshotInFlightByKey = new Map<string, Promise<FiberLocatorTileSnapshot>>();

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function parsePositiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.floor(parsed);
}

function parseLineIds(raw: string | undefined): readonly string[] {
  if (typeof raw !== "string") {
    throw new Error("FIBERLOCATOR_LINE_IDS is required (comma-separated layer ids)");
  }

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.toLowerCase());

  const dedupeInitialState: {
    seen: Set<string>;
    uniqueValues: string[];
  } = {
    seen: new Set<string>(),
    uniqueValues: [],
  };

  const uniqueValues = values.reduce((state, value) => {
    if (!state.seen.has(value)) {
      state.seen.add(value);
      state.uniqueValues.push(value);
    }

    return state;
  }, dedupeInitialState).uniqueValues;

  if (uniqueValues.length === 0) {
    throw new Error("FIBERLOCATOR_LINE_IDS must include at least one layer id");
  }

  return uniqueValues;
}

function buildTokenPathUrl(config: FiberLocatorConfig, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${config.apiBaseUrl}/${encodeURIComponent(config.staticToken)}${normalizedPath}`;
}

function buildInViewPath(config: FiberLocatorConfig, bbox: BBox): string {
  const encodedBbox = encodeURIComponent(formatBboxParam(bbox));
  const encodedBranches = config.lineIds.map((lineId) => encodeURIComponent(lineId)).join(",");
  return `/layers/inview/${encodedBbox}/${encodedBranches}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(record, key);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(record, key);
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUpstreamLayer(value: unknown): FiberLocatorUpstreamLayer | null {
  if (!isRecord(value)) {
    return null;
  }

  const layerName = readString(value, "layer_name");
  if (layerName === null) {
    return null;
  }

  const commonName = readString(value, "common_name") ?? layerName;
  const branch = readNullableString(value, "branch");
  const geomType = readNullableString(value, "geom_type");
  const color = readNullableString(value, "color");

  return {
    layerName,
    commonName,
    branch,
    geomType,
    color,
  };
}

function normalizeUpstreamLayerName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function toCatalogLayer(layer: FiberLocatorUpstreamLayer): FiberLocatorLayer {
  return {
    layerName: layer.layerName,
    commonName: layer.commonName,
    branch: layer.branch,
    geomType: layer.geomType,
    color: layer.color,
  };
}

function createLineSortOrder(lineIds: readonly string[]): Map<string, number> {
  return lineIds.reduce((sortOrder, lineId, index) => {
    sortOrder.set(lineId.toLowerCase(), index);
    return sortOrder;
  }, new Map<string, number>());
}

function layerLineSortIndex(
  layer: FiberLocatorUpstreamLayer,
  lineSortOrder: ReadonlyMap<string, number>
): number {
  const branch = layer.branch?.toLowerCase() ?? null;
  if (branch !== null) {
    const branchIndex = lineSortOrder.get(branch);
    if (typeof branchIndex === "number") {
      return branchIndex;
    }
  }

  const layerName = layer.layerName.toLowerCase();
  const layerNameIndex = lineSortOrder.get(layerName);
  if (typeof layerNameIndex === "number") {
    return layerNameIndex;
  }

  return lineSortOrder.size;
}

function shouldRetryUpstreamResponse(response: Response): boolean {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function retryDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt);
  return FIBER_LOCATOR_TILE_RETRY_BASE_DELAY_MS * 2 ** exponent;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      if (typeof signal !== "undefined") {
        signal.removeEventListener("abort", handleAbort);
      }
    };

    const handleAbort = (): void => {
      cleanup();
      reject(new Error("fiberlocator tile retry aborted"));
    };

    if (typeof signal !== "undefined") {
      if (signal.aborted) {
        cleanup();
        reject(new Error("fiberlocator tile retry aborted"));
        return;
      }

      signal.addEventListener("abort", handleAbort, { once: true });
    }
  });
}

function tileCacheKey(args: FiberLocatorTileRequest): string {
  return `${args.format}:${args.layerName}:${String(args.z)}:${String(args.x)}:${String(args.y)}`;
}

function copyTileHeaders(headers: Headers): Headers {
  const passThroughHeaders = [
    "cache-control",
    "content-type",
    "etag",
    "expires",
    "last-modified",
    "vary",
  ];

  return passThroughHeaders.reduce((copiedHeaders, headerName) => {
    const headerValue = headers.get(headerName);
    if (typeof headerValue === "string") {
      copiedHeaders.set(headerName, headerValue);
    }

    return copiedHeaders;
  }, new Headers());
}

function createTileSnapshotResponse(snapshot: FiberLocatorTileSnapshot): Response {
  return new Response(snapshot.body.slice(), {
    headers: new Headers(snapshot.headers),
    status: snapshot.status,
    statusText: snapshot.statusText,
  });
}

function isTileSnapshotFresh(
  config: FiberLocatorConfig,
  snapshot: FiberLocatorTileSnapshot,
  nowMs: number
): boolean {
  return nowMs - snapshot.cachedAtMs <= config.tileCacheTtlMs;
}

function pruneTileSnapshotCache(config: FiberLocatorConfig, nowMs: number): void {
  for (const [cacheKey, snapshot] of tileSnapshotByKey.entries()) {
    if (!isTileSnapshotFresh(config, snapshot, nowMs)) {
      tileSnapshotByKey.delete(cacheKey);
    }
  }

  while (tileSnapshotByKey.size > config.tileCacheMaxEntries) {
    const oldestCacheKey = tileSnapshotByKey.keys().next().value;
    if (typeof oldestCacheKey !== "string") {
      break;
    }
    tileSnapshotByKey.delete(oldestCacheKey);
  }
}

function cacheTileSnapshot(
  config: FiberLocatorConfig,
  cacheKey: string,
  snapshot: FiberLocatorTileSnapshot
): void {
  tileSnapshotByKey.set(cacheKey, snapshot);
  pruneTileSnapshotCache(config, Date.now());
}

async function fetchFiberLocatorTileFromUpstream(
  config: FiberLocatorConfig,
  args: FiberLocatorTileRequest,
  signal?: AbortSignal
): Promise<FiberLocatorTileSnapshot> {
  const upstreamPath =
    args.format === "png"
      ? `/tile/${encodeURIComponent(args.layerName)}/${String(args.z)}/${String(args.x)}/${String(args.y)}.png`
      : `/vector-tile/${encodeURIComponent(args.layerName)}/${String(args.z)}/${String(args.x)}/${String(args.y)}.pbf`;

  const upstreamUrl = buildTokenPathUrl(config, upstreamPath);
  const accept = args.format === "png" ? "image/png" : "application/x-protobuf";

  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept,
    },
  };
  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  let attempt = 0;
  while (attempt < FIBER_LOCATOR_TILE_RETRY_MAX_ATTEMPTS) {
    try {
      const { response } = await fetchWithTimeout(
        upstreamUrl,
        config.requestTimeoutMs,
        requestInit
      );
      if (
        shouldRetryUpstreamResponse(response) &&
        attempt < FIBER_LOCATOR_TILE_RETRY_MAX_ATTEMPTS - 1
      ) {
        response.body?.cancel();
      } else {
        const body = new Uint8Array(await response.arrayBuffer());
        return {
          body,
          cachedAtMs: Date.now(),
          headers: copyTileHeaders(response.headers),
          status: response.status,
          statusText: response.statusText,
        };
      }
    } catch (error) {
      if (attempt >= FIBER_LOCATOR_TILE_RETRY_MAX_ATTEMPTS - 1) {
        throw error;
      }
    }

    const waitMs = retryDelayMs(attempt);
    attempt += 1;
    await delay(waitMs, signal);
  }

  throw new Error("fiberlocator tile request exceeded retry attempts");
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init: RequestInit = {}
): Promise<FetchWithTimeoutResult> {
  const timeoutController = new AbortController();
  const externalSignal = init.signal ?? null;

  const onAbort = (): void => {
    timeoutController.abort();
  };

  if (externalSignal !== null) {
    if (externalSignal.aborted) {
      timeoutController.abort();
    }
    externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeoutController.signal,
    });

    return { response };
  } finally {
    clearTimeout(timeoutHandle);
    if (externalSignal !== null) {
      externalSignal.removeEventListener("abort", onAbort);
    }
  }
}

export function isAllowedFiberLocatorLayer(config: FiberLocatorConfig, layerName: string): boolean {
  return config.lineIds.includes(layerName.toLowerCase());
}

export function readFiberLocatorConfig(): FiberLocatorConfig {
  const apiBaseUrl = process.env.FIBERLOCATOR_API_BASE_URL;
  const staticToken = process.env.FIBERLOCATOR_STATIC_TOKEN;

  if (typeof apiBaseUrl !== "string" || apiBaseUrl.trim().length === 0) {
    throw new Error("FIBERLOCATOR_API_BASE_URL is required");
  }

  if (typeof staticToken !== "string" || staticToken.trim().length === 0) {
    throw new Error("FIBERLOCATOR_STATIC_TOKEN is required");
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
    requestTimeoutMs: parsePositiveIntEnv("FIBERLOCATOR_REQUEST_TIMEOUT_MS", 30_000),
    lineIds: parseLineIds(process.env.FIBERLOCATOR_LINE_IDS),
    staticToken: staticToken.trim(),
    tileCacheMaxEntries: parsePositiveIntEnv(
      "FIBERLOCATOR_TILE_CACHE_MAX_ENTRIES",
      FIBER_LOCATOR_TILE_CACHE_MAX_ENTRIES
    ),
    tileCacheTtlMs: parsePositiveIntEnv(
      "FIBERLOCATOR_TILE_CACHE_TTL_MS",
      FIBER_LOCATOR_TILE_CACHE_TTL_MS
    ),
  };
}

export async function fetchFiberLocatorCatalog(
  config: FiberLocatorConfig,
  signal?: AbortSignal
): Promise<FiberLocatorCatalogResult> {
  const upstreamUrl = buildTokenPathUrl(config, "/layers/toc");
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  };
  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  const { response } = await fetchWithTimeout(upstreamUrl, config.requestTimeoutMs, requestInit);

  if (!response.ok) {
    throw new Error(
      `fiberlocator layers request failed (${String(response.status)} ${response.statusText})`
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("fiberlocator layers response was not valid JSON");
  }

  if (!isRecord(payload)) {
    throw new Error("fiberlocator layers response payload was not an object");
  }

  const status = Reflect.get(payload, "status");
  if (status !== "ok") {
    throw new Error("fiberlocator layers response status was not ok");
  }

  const result = Reflect.get(payload, "result");
  if (!Array.isArray(result)) {
    throw new Error("fiberlocator layers response did not include result[]");
  }

  const allowedLayers = new Set(config.lineIds.map((lineId) => lineId.toLowerCase()));
  const lineSortOrder = createLineSortOrder(config.lineIds);
  const upstreamLayersByName = result.reduce<Map<string, FiberLocatorUpstreamLayer>>(
    (layersByName, rawLayer) => {
      const normalizedLayer = normalizeUpstreamLayer(rawLayer);
      if (normalizedLayer === null) {
        return layersByName;
      }

      const normalizedLayerName = normalizedLayer.layerName.toLowerCase();
      const normalizedBranch = normalizedLayer.branch?.toLowerCase() ?? null;
      const isMatchingLineId =
        allowedLayers.has(normalizedLayerName) ||
        (normalizedBranch !== null && allowedLayers.has(normalizedBranch));
      if (!isMatchingLineId || layersByName.has(normalizedLayerName)) {
        return layersByName;
      }

      layersByName.set(normalizedLayerName, normalizedLayer);
      return layersByName;
    },
    new Map<string, FiberLocatorUpstreamLayer>()
  );

  const layers = Array.from(upstreamLayersByName.values())
    .sort((left, right) => {
      const leftLineIndex = layerLineSortIndex(left, lineSortOrder);
      const rightLineIndex = layerLineSortIndex(right, lineSortOrder);
      if (leftLineIndex !== rightLineIndex) {
        return leftLineIndex - rightLineIndex;
      }

      return left.layerName.localeCompare(right.layerName);
    })
    .map((layer) => toCatalogLayer(layer));

  return {
    layers,
  };
}

export async function fetchFiberLocatorLayersInView(
  config: FiberLocatorConfig,
  bbox: BBox,
  signal?: AbortSignal
): Promise<FiberLocatorLayersInViewResult> {
  const upstreamUrl = buildTokenPathUrl(config, buildInViewPath(config, bbox));
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  };
  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  const { response } = await fetchWithTimeout(upstreamUrl, config.requestTimeoutMs, requestInit);

  if (!response.ok) {
    throw new Error(
      `fiberlocator layers/inview request failed (${String(response.status)} ${response.statusText})`
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("fiberlocator layers/inview response was not valid JSON");
  }

  if (!isRecord(payload)) {
    throw new Error("fiberlocator layers/inview response payload was not an object");
  }

  const status = Reflect.get(payload, "status");
  if (status !== "ok") {
    throw new Error("fiberlocator layers/inview response status was not ok");
  }

  const result = Reflect.get(payload, "result");
  if (!Array.isArray(result)) {
    throw new Error("fiberlocator layers/inview response did not include result[]");
  }

  const seen = new Set<string>();
  const layerNames = result.reduce<string[]>((accumulator, rawLayerName) => {
    const normalizedLayerName = normalizeUpstreamLayerName(rawLayerName);
    if (normalizedLayerName === null || seen.has(normalizedLayerName)) {
      return accumulator;
    }

    seen.add(normalizedLayerName);
    accumulator.push(normalizedLayerName);
    return accumulator;
  }, []);

  return {
    layerNames,
  };
}

export function fetchFiberLocatorTile(
  config: FiberLocatorConfig,
  args: FiberLocatorTileRequest,
  signal?: AbortSignal
): Promise<Response> {
  const cacheKey = tileCacheKey(args);
  const nowMs = Date.now();

  pruneTileSnapshotCache(config, nowMs);
  const cachedSnapshot = tileSnapshotByKey.get(cacheKey);
  if (typeof cachedSnapshot !== "undefined" && isTileSnapshotFresh(config, cachedSnapshot, nowMs)) {
    return Promise.resolve(createTileSnapshotResponse(cachedSnapshot));
  }
  if (typeof cachedSnapshot !== "undefined") {
    tileSnapshotByKey.delete(cacheKey);
  }

  let inFlightSnapshotPromise = tileSnapshotInFlightByKey.get(cacheKey);
  if (typeof inFlightSnapshotPromise === "undefined") {
    inFlightSnapshotPromise = fetchFiberLocatorTileFromUpstream(config, args, signal)
      .then((snapshot) => {
        if (snapshot.status >= 200 && snapshot.status < 300) {
          cacheTileSnapshot(config, cacheKey, snapshot);
        }
        return snapshot;
      })
      .finally(() => {
        tileSnapshotInFlightByKey.delete(cacheKey);
      });

    tileSnapshotInFlightByKey.set(cacheKey, inFlightSnapshotPromise);
  }

  return inFlightSnapshotPromise.then((snapshot) => createTileSnapshotResponse(snapshot));
}
