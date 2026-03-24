import type { FacilitiesPerformanceSnapshot } from "@map-migration/http-contracts/facilities-performance-http";
import type { FacilitiesCacheStatus } from "@/geo/facilities/route/facilities-cache.types";

interface MeasurementAccumulator {
  count: number;
  last: number;
  max: number;
  min: number;
  total: number;
}

interface PerspectiveAccumulator {
  abortedCount: number;
  boundDatasetVersion: string | null;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheStaleCount: number;
  completedCount: number;
  failedCount: number;
  lastCacheStatus: FacilitiesCacheStatus | null;
  lastCanonicalBboxKey: string | null;
  lastEffectiveLimit: number | null;
  lastInteractionType: string | null;
  lastRowCount: number | null;
  lastTruncated: boolean | null;
  lastViewMode: string | null;
  lastViewportKey: string | null;
  lastZoomBucket: number | null;
  mappingTimeMs: MeasurementAccumulator;
  requestCount: number;
  requestedDatasetVersion: string | null;
  responseBytes: MeasurementAccumulator;
  routeLatencyMs: MeasurementAccumulator;
  sqlTimeMs: MeasurementAccumulator;
}

interface FacilitiesPerformanceState {
  readonly cache: {
    configured: boolean;
    hitCount: number;
    missCount: number;
    redisUnavailableCount: number;
    singleflightJoinedCount: number;
    staleCount: number;
    valueBytes: MeasurementAccumulator;
    writeSkippedPayloadTooLargeCount: number;
  };
  readonly db: {
    clientAbortCount: number;
    queueWaitMs: MeasurementAccumulator;
    statementTimeoutCount: number;
  };
  readonly perspectives: Map<string, PerspectiveAccumulator>;
}

export interface RecordFacilitiesBboxMetricsArgs {
  readonly boundDatasetVersion: string;
  readonly cacheStatus: FacilitiesCacheStatus | null;
  readonly canonicalBboxKey: string;
  readonly effectiveLimit: number;
  readonly interactionType: string | null;
  readonly mappingTimeMs: number;
  readonly outcome: "aborted" | "completed" | "failed";
  readonly perspective: string;
  readonly requestedDatasetVersion: string | null;
  readonly responseBytes: number;
  readonly routeLatencyMs: number;
  readonly rowCount: number;
  readonly sqlTimeMs: number;
  readonly truncated: boolean;
  readonly viewMode: string | null;
  readonly viewportKey: string | null;
  readonly zoomBucket: number | null;
}

function createMeasurementAccumulator(): MeasurementAccumulator {
  return {
    count: 0,
    last: 0,
    max: 0,
    min: 0,
    total: 0,
  };
}

function createPerspectiveAccumulator(): PerspectiveAccumulator {
  return {
    abortedCount: 0,
    boundDatasetVersion: null,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cacheStaleCount: 0,
    completedCount: 0,
    failedCount: 0,
    lastCacheStatus: null,
    lastInteractionType: null,
    lastCanonicalBboxKey: null,
    lastEffectiveLimit: null,
    lastRowCount: null,
    lastTruncated: null,
    lastViewMode: null,
    lastViewportKey: null,
    lastZoomBucket: null,
    mappingTimeMs: createMeasurementAccumulator(),
    requestedDatasetVersion: null,
    requestCount: 0,
    responseBytes: createMeasurementAccumulator(),
    routeLatencyMs: createMeasurementAccumulator(),
    sqlTimeMs: createMeasurementAccumulator(),
  };
}

const state: FacilitiesPerformanceState = {
  cache: {
    configured: false,
    hitCount: 0,
    missCount: 0,
    redisUnavailableCount: 0,
    singleflightJoinedCount: 0,
    staleCount: 0,
    valueBytes: createMeasurementAccumulator(),
    writeSkippedPayloadTooLargeCount: 0,
  },
  db: {
    clientAbortCount: 0,
    queueWaitMs: createMeasurementAccumulator(),
    statementTimeoutCount: 0,
  },
  perspectives: new Map(),
};

let lastResetAt = new Date().toISOString();

function updateMeasurement(accumulator: MeasurementAccumulator, value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }

  accumulator.count += 1;
  accumulator.last = value;
  accumulator.max = accumulator.count === 1 ? value : Math.max(accumulator.max, value);
  accumulator.min = accumulator.count === 1 ? value : Math.min(accumulator.min, value);
  accumulator.total += value;
}

function toMeasurementSnapshot(accumulator: MeasurementAccumulator) {
  return {
    average: accumulator.count === 0 ? 0 : accumulator.total / accumulator.count,
    count: accumulator.count,
    last: accumulator.last,
    max: accumulator.max,
    min: accumulator.min,
    total: accumulator.total,
  };
}

function getPerspectiveAccumulator(perspective: string): PerspectiveAccumulator {
  const existing = state.perspectives.get(perspective);
  if (existing !== undefined) {
    return existing;
  }

  const created = createPerspectiveAccumulator();
  state.perspectives.set(perspective, created);
  return created;
}

export function resetFacilitiesPerformanceSnapshot(): void {
  state.cache.configured = false;
  state.cache.hitCount = 0;
  state.cache.missCount = 0;
  state.cache.redisUnavailableCount = 0;
  state.cache.singleflightJoinedCount = 0;
  state.cache.staleCount = 0;
  state.cache.valueBytes = createMeasurementAccumulator();
  state.cache.writeSkippedPayloadTooLargeCount = 0;
  state.db.clientAbortCount = 0;
  state.db.queueWaitMs = createMeasurementAccumulator();
  state.db.statementTimeoutCount = 0;
  state.perspectives.clear();
  lastResetAt = new Date().toISOString();
}

export function setFacilitiesCacheConfigured(configured: boolean): void {
  state.cache.configured = configured;
}

export function recordFacilitiesCacheHit(): void {
  state.cache.hitCount += 1;
}

export function recordFacilitiesCacheMiss(): void {
  state.cache.missCount += 1;
}

export function recordFacilitiesCacheStale(): void {
  state.cache.staleCount += 1;
}

export function recordFacilitiesCacheRedisUnavailable(): void {
  state.cache.redisUnavailableCount += 1;
}

export function recordFacilitiesCacheSingleflightJoined(): void {
  state.cache.singleflightJoinedCount += 1;
}

export function recordFacilitiesCacheValueBytes(valueBytes: number): void {
  updateMeasurement(state.cache.valueBytes, valueBytes);
}

export function recordFacilitiesCacheWriteSkippedPayloadTooLarge(): void {
  state.cache.writeSkippedPayloadTooLargeCount += 1;
}

export function recordFacilitiesBboxMetrics(args: RecordFacilitiesBboxMetricsArgs): void {
  const perspective = getPerspectiveAccumulator(args.perspective);
  perspective.requestCount += 1;
  perspective.boundDatasetVersion = args.boundDatasetVersion;
  perspective.lastCacheStatus = args.cacheStatus;
  perspective.lastCanonicalBboxKey = args.canonicalBboxKey;
  perspective.lastEffectiveLimit = args.effectiveLimit;
  perspective.lastInteractionType = args.interactionType;
  perspective.lastRowCount = args.rowCount;
  perspective.lastTruncated = args.truncated;
  perspective.lastViewMode = args.viewMode;
  perspective.lastViewportKey = args.viewportKey;
  perspective.lastZoomBucket = args.zoomBucket;
  perspective.requestedDatasetVersion = args.requestedDatasetVersion;

  if (args.outcome === "completed") {
    perspective.completedCount += 1;
  } else if (args.outcome === "aborted") {
    perspective.abortedCount += 1;
  } else {
    perspective.failedCount += 1;
  }

  if (args.cacheStatus === "redis-hit") {
    perspective.cacheHitCount += 1;
  } else if (args.cacheStatus === "stale") {
    perspective.cacheStaleCount += 1;
  } else if (args.cacheStatus === "miss") {
    perspective.cacheMissCount += 1;
  }

  updateMeasurement(perspective.routeLatencyMs, args.routeLatencyMs);
  updateMeasurement(perspective.sqlTimeMs, args.sqlTimeMs);
  updateMeasurement(perspective.mappingTimeMs, args.mappingTimeMs);
  updateMeasurement(perspective.responseBytes, args.responseBytes);
}

export function recordFacilitiesDbQueueWait(queueWaitMs: number): void {
  updateMeasurement(state.db.queueWaitMs, queueWaitMs);
}

export function recordFacilitiesDbClientAbort(): void {
  state.db.clientAbortCount += 1;
}

export function recordFacilitiesDbStatementTimeout(): void {
  state.db.statementTimeoutCount += 1;
}

export function getFacilitiesPerformanceSnapshot(): FacilitiesPerformanceSnapshot {
  const perspectives = Object.fromEntries(
    Array.from(state.perspectives.entries()).map(([perspective, accumulator]) => [
      perspective,
      {
        abortedCount: accumulator.abortedCount,
        boundDatasetVersion: accumulator.boundDatasetVersion,
        cacheHitCount: accumulator.cacheHitCount,
        cacheMissCount: accumulator.cacheMissCount,
        cacheStaleCount: accumulator.cacheStaleCount,
        completedCount: accumulator.completedCount,
        failedCount: accumulator.failedCount,
        lastCacheStatus: accumulator.lastCacheStatus,
        lastInteractionType: accumulator.lastInteractionType,
        lastCanonicalBboxKey: accumulator.lastCanonicalBboxKey,
        lastEffectiveLimit: accumulator.lastEffectiveLimit,
        lastRowCount: accumulator.lastRowCount,
        lastTruncated: accumulator.lastTruncated,
        lastViewMode: accumulator.lastViewMode,
        lastViewportKey: accumulator.lastViewportKey,
        lastZoomBucket: accumulator.lastZoomBucket,
        mappingTimeMs: toMeasurementSnapshot(accumulator.mappingTimeMs),
        requestedDatasetVersion: accumulator.requestedDatasetVersion,
        requestCount: accumulator.requestCount,
        responseBytes: toMeasurementSnapshot(accumulator.responseBytes),
        routeLatencyMs: toMeasurementSnapshot(accumulator.routeLatencyMs),
        sqlTimeMs: toMeasurementSnapshot(accumulator.sqlTimeMs),
      },
    ])
  );

  return {
    bbox: {
      perspectives,
    },
    cache: {
      configured: state.cache.configured,
      hitCount: state.cache.hitCount,
      missCount: state.cache.missCount,
      redisUnavailableCount: state.cache.redisUnavailableCount,
      singleflightJoinedCount: state.cache.singleflightJoinedCount,
      staleCount: state.cache.staleCount,
      valueBytes: toMeasurementSnapshot(state.cache.valueBytes),
      writeSkippedPayloadTooLargeCount: state.cache.writeSkippedPayloadTooLargeCount,
    },
    db: {
      clientAbortCount: state.db.clientAbortCount,
      queueWaitMs: toMeasurementSnapshot(state.db.queueWaitMs),
      statementTimeoutCount: state.db.statementTimeoutCount,
    },
    generatedAt: new Date().toISOString(),
    lastResetAt,
    status: "ok",
  };
}
