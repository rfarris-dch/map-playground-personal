import { type BBox, formatBboxParam } from "@map-migration/contracts";
import type {
  FiberLocatorCatalogResult,
  FiberLocatorConfig,
  FiberLocatorLayersInViewResult,
  FiberLocatorTileRequest,
  FiberLocatorUpstreamLayer,
} from "@/geo/fiber-locator/fiber-locator.types";
import {
  type FiberLocatorConfigDefaults,
  readFiberLocatorConfig as readFiberLocatorConfigFromEnv,
} from "@/geo/fiber-locator/fiber-locator-config.service";
import {
  createLineSortOrder,
  layerLineSortIndex,
  normalizeUpstreamLayer,
  normalizeUpstreamLayerName,
  payloadRecordOrThrow,
  toCatalogLayer,
} from "@/geo/fiber-locator/fiber-locator-upstream-payload.service";
import type {
  FetchWithTimeoutResult,
  FiberLocatorTileSnapshot,
} from "./fiber-locator.service.types";

const FIBER_LOCATOR_TILE_RETRY_MAX_ATTEMPTS = 3;
const FIBER_LOCATOR_TILE_RETRY_BASE_DELAY_MS = 250;
const FIBER_LOCATOR_TILE_CACHE_TTL_MS = 15_000;
const FIBER_LOCATOR_TILE_CACHE_MAX_ENTRIES = 512;

const tileSnapshotByKey = new Map<string, FiberLocatorTileSnapshot>();
const tileSnapshotInFlightByKey = new Map<string, Promise<FiberLocatorTileSnapshot>>();
const fiberLocatorConfigDefaults: FiberLocatorConfigDefaults = {
  requestTimeoutMs: 30_000,
  tileCacheMaxEntries: FIBER_LOCATOR_TILE_CACHE_MAX_ENTRIES,
  tileCacheTtlMs: FIBER_LOCATOR_TILE_CACHE_TTL_MS,
};

function buildTokenPathUrl(config: FiberLocatorConfig, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${config.apiBaseUrl}/${encodeURIComponent(config.staticToken)}${normalizedPath}`;
}

function buildInViewPath(config: FiberLocatorConfig, bbox: BBox): string {
  const encodedBbox = encodeURIComponent(formatBboxParam(bbox));
  const encodedBranches = config.lineIds.map((lineId) => encodeURIComponent(lineId)).join(",");
  return `/layers/inview/${encodedBbox}/${encodedBranches}`;
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
  return readFiberLocatorConfigFromEnv(fiberLocatorConfigDefaults);
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

  const payloadRecord = payloadRecordOrThrow(payload, "fiberlocator layers response");

  const status = Reflect.get(payloadRecord, "status");
  if (status !== "ok") {
    throw new Error("fiberlocator layers response status was not ok");
  }

  const result = Reflect.get(payloadRecord, "result");
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

  const payloadRecord = payloadRecordOrThrow(payload, "fiberlocator layers/inview response");

  const status = Reflect.get(payloadRecord, "status");
  if (status !== "ok") {
    throw new Error("fiberlocator layers/inview response status was not ok");
  }

  const result = Reflect.get(payloadRecord, "result");
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
