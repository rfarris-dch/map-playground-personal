import type { FiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.types";
import type { FiberLocatorTileSnapshot } from "./fiber-locator.service.types";

const tileSnapshotByKey = new Map<string, FiberLocatorTileSnapshot>();
const tileSnapshotInFlightByKey = new Map<string, Promise<FiberLocatorTileSnapshot>>();

export function tileCacheKey(
  layerName: string,
  format: "png" | "pbf",
  z: number,
  x: number,
  y: number
): string {
  return `${format}:${layerName}:${String(z)}:${String(x)}:${String(y)}`;
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

export function readFreshTileSnapshot(
  config: FiberLocatorConfig,
  cacheKey: string,
  nowMs: number
): FiberLocatorTileSnapshot | null {
  pruneTileSnapshotCache(config, nowMs);

  const snapshot = tileSnapshotByKey.get(cacheKey);
  if (typeof snapshot === "undefined") {
    return null;
  }

  if (!isTileSnapshotFresh(config, snapshot, nowMs)) {
    tileSnapshotByKey.delete(cacheKey);
    return null;
  }

  return snapshot;
}

export function cacheTileSnapshot(
  config: FiberLocatorConfig,
  cacheKey: string,
  snapshot: FiberLocatorTileSnapshot
): void {
  tileSnapshotByKey.set(cacheKey, snapshot);
  pruneTileSnapshotCache(config, Date.now());
}

export function getInFlightTileSnapshot(
  cacheKey: string
): Promise<FiberLocatorTileSnapshot> | undefined {
  return tileSnapshotInFlightByKey.get(cacheKey);
}

export function setInFlightTileSnapshot(
  cacheKey: string,
  promise: Promise<FiberLocatorTileSnapshot>
): void {
  tileSnapshotInFlightByKey.set(cacheKey, promise);
}

export function clearInFlightTileSnapshot(cacheKey: string): void {
  tileSnapshotInFlightByKey.delete(cacheKey);
}
