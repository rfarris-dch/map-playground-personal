import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import {
  recordFacilitiesCacheHit,
  recordFacilitiesCacheMiss,
  recordFacilitiesCacheStale,
  setFacilitiesCacheConfigured,
} from "@/geo/facilities/route/facilities-performance.service";
import type {
  FacilitiesCacheEntry,
  FacilitiesCacheHeaders,
  FacilitiesCacheStatus,
} from "./facilities-cache.types";

declare const Bun: {
  RedisClient: new (
    url: string
  ) => {
    del(key: string): Promise<number>;
    get(key: string): Promise<string | null>;
    ping(): Promise<string>;
    set(key: string, value: string, mode?: string, seconds?: number): Promise<unknown>;
  };
};

const REDIS_URL = (process.env.API_REDIS_URL ?? process.env.REDIS_URL ?? "").trim();
const FACILITIES_CACHE_TTL_SECONDS = parsePositiveIntFlag(
  process.env.API_FACILITIES_CACHE_TTL_SECONDS,
  60
);
const FACILITIES_CACHE_STALE_TTL_SECONDS = parsePositiveIntFlag(
  process.env.API_FACILITIES_CACHE_STALE_TTL_SECONDS,
  300
);
const FACILITIES_CACHE_MAX_PAYLOAD_BYTES = parsePositiveIntFlag(
  process.env.API_FACILITIES_CACHE_MAX_PAYLOAD_BYTES,
  2_000_000
);
const FACILITIES_CACHE_CIRCUIT_BREAKER_MS = parsePositiveIntFlag(
  process.env.API_FACILITIES_CACHE_CIRCUIT_BREAKER_MS,
  30_000
);
const FACILITIES_SHARED_CACHE_MAX_AGE_SECONDS = parsePositiveIntFlag(
  process.env.API_FACILITIES_SHARED_CACHE_MAX_AGE_SECONDS,
  30
);

setFacilitiesCacheConfigured(REDIS_URL.length > 0);

const redisClient = REDIS_URL.length > 0 ? new Bun.RedisClient(REDIS_URL) : null;

const cacheFillFlights = new Map<string, Promise<string>>();

let redisUnavailableUntilEpochMs = 0;

function nowEpochMs(): number {
  return Date.now();
}

function isCacheConfigured(): boolean {
  return redisClient !== null;
}

function isCacheAvailable(): boolean {
  return isCacheConfigured() && nowEpochMs() >= redisUnavailableUntilEpochMs;
}

function markRedisUnavailable(): void {
  redisUnavailableUntilEpochMs = nowEpochMs() + FACILITIES_CACHE_CIRCUIT_BREAKER_MS;
}

function clearRedisUnavailable(): void {
  redisUnavailableUntilEpochMs = 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCacheEntry<TPayload>(serialized: string): FacilitiesCacheEntry<TPayload> | null {
  try {
    const parsed = JSON.parse(serialized);
    if (!isRecord(parsed)) {
      return null;
    }

    const dataVersion = parsed.dataVersion;
    const datasetVersion = parsed.datasetVersion;
    const etag = parsed.etag;
    const freshUntilEpochMs = parsed.freshUntilEpochMs;
    const generatedAt = parsed.generatedAt;
    const originRequestId = parsed.originRequestId;
    const payloadBytes = parsed.payloadBytes;
    if (
      typeof dataVersion !== "string" ||
      typeof datasetVersion !== "string" ||
      typeof etag !== "string" ||
      typeof freshUntilEpochMs !== "number" ||
      typeof generatedAt !== "string" ||
      typeof originRequestId !== "string" ||
      typeof payloadBytes !== "number" ||
      !("payload" in parsed)
    ) {
      return null;
    }

    return {
      dataVersion,
      datasetVersion,
      etag,
      freshUntilEpochMs,
      generatedAt,
      originRequestId,
      payloadBytes,
      payload: parsed.payload as TPayload,
    };
  } catch {
    return null;
  }
}

async function readCacheEntry<TPayload>(
  key: string
): Promise<FacilitiesCacheEntry<TPayload> | null> {
  if (!isCacheAvailable()) {
    return null;
  }

  if (redisClient === null) {
    return null;
  }

  try {
    const serialized = await redisClient.get(key);
    clearRedisUnavailable();
    if (serialized === null) {
      return null;
    }

    const parsed = parseCacheEntry<TPayload>(serialized);
    if (parsed !== null) {
      return parsed;
    }

    await redisClient.del(key);
    return null;
  } catch {
    markRedisUnavailable();
    return null;
  }
}

async function writeCacheEntry<TPayload>(
  key: string,
  entry: FacilitiesCacheEntry<TPayload>
): Promise<void> {
  if (!isCacheAvailable()) {
    return;
  }

  if (redisClient === null) {
    return;
  }

  const serialized = JSON.stringify(entry);
  if (serialized.length > FACILITIES_CACHE_MAX_PAYLOAD_BYTES) {
    return;
  }

  try {
    await redisClient.set(key, serialized, "EX", FACILITIES_CACHE_STALE_TTL_SECONDS);
    clearRedisUnavailable();
  } catch {
    markRedisUnavailable();
  }
}

function joinCacheFill(key: string, loadFresh: () => Promise<string>): Promise<string> {
  const inFlight = cacheFillFlights.get(key);
  if (typeof inFlight !== "undefined") {
    return inFlight;
  }

  const started = loadFresh().finally(() => {
    cacheFillFlights.delete(key);
  });
  cacheFillFlights.set(key, started);
  return started;
}

export async function assertFacilitiesCacheReachable(): Promise<boolean> {
  if (!isCacheAvailable()) {
    return false;
  }

  if (redisClient === null) {
    return false;
  }

  try {
    await redisClient.ping();
    clearRedisUnavailable();
    return true;
  } catch {
    markRedisUnavailable();
    return false;
  }
}

export function createFacilitiesCacheHeaders(args: {
  readonly cacheStatus: FacilitiesCacheStatus;
  readonly dataVersion: string;
  readonly datasetVersion: string;
  readonly etag: string;
  readonly originRequestId: string;
}): FacilitiesCacheHeaders {
  return {
    cacheStatus: args.cacheStatus,
    dataVersion: args.dataVersion,
    datasetVersion: args.datasetVersion,
    etag: args.etag,
    originRequestId: args.originRequestId,
  };
}

export function getFacilitiesSharedCacheControl(): string {
  return [
    "public",
    `max-age=${String(FACILITIES_SHARED_CACHE_MAX_AGE_SECONDS)}`,
    `s-maxage=${String(FACILITIES_CACHE_TTL_SECONDS)}`,
    `stale-while-revalidate=${String(FACILITIES_CACHE_STALE_TTL_SECONDS)}`,
    `stale-if-error=${String(FACILITIES_CACHE_STALE_TTL_SECONDS)}`,
  ].join(", ");
}

export async function resolveFacilitiesCachedEntry<TPayload>(args: {
  readonly allowStaleOnError?: (error: unknown) => boolean;
  readonly buildFreshEntry: () => Promise<FacilitiesCacheEntry<TPayload>>;
  readonly key: string;
}): Promise<{
  readonly cacheStatus: FacilitiesCacheStatus;
  readonly entry: FacilitiesCacheEntry<TPayload>;
}> {
  if (!isCacheConfigured()) {
    recordFacilitiesCacheMiss();
    return {
      cacheStatus: "miss",
      entry: await args.buildFreshEntry(),
    };
  }

  const cachedEntry = await readCacheEntry<TPayload>(args.key);
  const currentEpochMs = nowEpochMs();
  if (cachedEntry !== null && currentEpochMs <= cachedEntry.freshUntilEpochMs) {
    recordFacilitiesCacheHit();
    return {
      cacheStatus: "redis-hit",
      entry: cachedEntry,
    };
  }

  try {
    const serializedFreshEntry = await joinCacheFill(args.key, async () => {
      const freshEntry = await args.buildFreshEntry();
      await writeCacheEntry(args.key, freshEntry);
      return JSON.stringify(freshEntry);
    });
    recordFacilitiesCacheMiss();
    const parsedFreshEntry = parseCacheEntry<TPayload>(serializedFreshEntry);
    if (parsedFreshEntry === null) {
      throw new Error("Facilities cache fill produced an invalid cache entry");
    }

    return {
      cacheStatus: "miss",
      entry: parsedFreshEntry,
    };
  } catch (error) {
    if (cachedEntry !== null && (args.allowStaleOnError?.(error) ?? false)) {
      recordFacilitiesCacheStale();
      return {
        cacheStatus: "stale",
        entry: cachedEntry,
      };
    }

    throw error;
  }
}

export function buildFacilitiesCacheEntry<TPayload>(args: {
  readonly dataVersion: string;
  readonly datasetVersion: string;
  readonly etag: string;
  readonly generatedAt: string;
  readonly originRequestId: string;
  readonly payload: TPayload;
  readonly payloadBytes: number;
}): FacilitiesCacheEntry<TPayload> {
  return {
    dataVersion: args.dataVersion,
    datasetVersion: args.datasetVersion,
    etag: args.etag,
    freshUntilEpochMs: nowEpochMs() + FACILITIES_CACHE_TTL_SECONDS * 1000,
    generatedAt: args.generatedAt,
    originRequestId: args.originRequestId,
    payloadBytes: args.payloadBytes,
    payload: args.payload,
  };
}
