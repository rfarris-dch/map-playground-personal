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
import type { FiberLocatorTileSnapshot } from "./fiber-locator.service.types";
import {
  createTileSnapshotResponse,
  fetchFiberLocatorTileSnapshot,
  fetchWithTimeout,
  waitForAbortableValue,
} from "./fiber-locator-fetch.service";
import {
  cacheTileSnapshot,
  clearInFlightTileSnapshot,
  getInFlightTileSnapshot,
  readFreshTileSnapshot,
  setInFlightTileSnapshot,
  tileCacheKey,
} from "./fiber-locator-tile-cache.service";

const FIBER_LOCATOR_TILE_CACHE_TTL_MS = 15_000;
const FIBER_LOCATOR_TILE_CACHE_MAX_ENTRIES = 512;

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

function fetchFiberLocatorTileFromUpstream(
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
  return fetchFiberLocatorTileSnapshot(config, upstreamUrl, accept, signal);
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
  const cacheKey = tileCacheKey(args.layerName, args.format, args.z, args.x, args.y);
  const nowMs = Date.now();

  const cachedSnapshot = readFreshTileSnapshot(config, cacheKey, nowMs);
  if (cachedSnapshot !== null) {
    return waitForAbortableValue(Promise.resolve(cachedSnapshot), signal).then((snapshot) =>
      createTileSnapshotResponse(snapshot)
    );
  }

  let inFlightSnapshotPromise = getInFlightTileSnapshot(cacheKey);
  if (typeof inFlightSnapshotPromise === "undefined") {
    // Keep the shared upstream fetch independent from any single caller's abort signal.
    inFlightSnapshotPromise = fetchFiberLocatorTileFromUpstream(config, args)
      .then((snapshot) => {
        if (snapshot.status >= 200 && snapshot.status < 300) {
          cacheTileSnapshot(config, cacheKey, snapshot);
        }
        return snapshot;
      })
      .finally(() => {
        clearInFlightTileSnapshot(cacheKey);
      });

    setInFlightTileSnapshot(cacheKey, inFlightSnapshotPromise);
  }

  return waitForAbortableValue(inFlightSnapshotPromise, signal).then((snapshot) =>
    createTileSnapshotResponse(snapshot)
  );
}
