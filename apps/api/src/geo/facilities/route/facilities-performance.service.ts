import type { FacilitiesPerformanceSnapshot } from "@map-migration/http-contracts/facilities-performance-http";

interface MeasurementAccumulator {
  count: number;
  last: number;
  max: number;
  min: number;
  total: number;
}

interface PerspectiveAccumulator {
  abortedCount: number;
  completedCount: number;
  failedCount: number;
  lastCanonicalBboxKey: string | null;
  lastEffectiveLimit: number | null;
  lastRowCount: number | null;
  lastTruncated: boolean | null;
  mappingTimeMs: MeasurementAccumulator;
  requestCount: number;
  responseBytes: MeasurementAccumulator;
  routeLatencyMs: MeasurementAccumulator;
  sqlTimeMs: MeasurementAccumulator;
}

interface FacilitiesPerformanceState {
  readonly cache: {
    configured: boolean;
    hitCount: number;
    missCount: number;
    staleCount: number;
  };
  readonly db: {
    clientAbortCount: number;
    queueWaitMs: MeasurementAccumulator;
    statementTimeoutCount: number;
  };
  readonly perspectives: Map<string, PerspectiveAccumulator>;
}

export interface RecordFacilitiesBboxMetricsArgs {
  readonly canonicalBboxKey: string;
  readonly effectiveLimit: number;
  readonly mappingTimeMs: number;
  readonly outcome: "aborted" | "completed" | "failed";
  readonly perspective: string;
  readonly responseBytes: number;
  readonly routeLatencyMs: number;
  readonly rowCount: number;
  readonly sqlTimeMs: number;
  readonly truncated: boolean;
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
    completedCount: 0,
    failedCount: 0,
    lastCanonicalBboxKey: null,
    lastEffectiveLimit: null,
    lastRowCount: null,
    lastTruncated: null,
    mappingTimeMs: createMeasurementAccumulator(),
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
    staleCount: 0,
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
  state.cache.staleCount = 0;
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

export function recordFacilitiesBboxMetrics(args: RecordFacilitiesBboxMetricsArgs): void {
  const perspective = getPerspectiveAccumulator(args.perspective);
  perspective.requestCount += 1;
  perspective.lastCanonicalBboxKey = args.canonicalBboxKey;
  perspective.lastEffectiveLimit = args.effectiveLimit;
  perspective.lastRowCount = args.rowCount;
  perspective.lastTruncated = args.truncated;

  if (args.outcome === "completed") {
    perspective.completedCount += 1;
  } else if (args.outcome === "aborted") {
    perspective.abortedCount += 1;
  } else {
    perspective.failedCount += 1;
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
        completedCount: accumulator.completedCount,
        failedCount: accumulator.failedCount,
        lastCanonicalBboxKey: accumulator.lastCanonicalBboxKey,
        lastEffectiveLimit: accumulator.lastEffectiveLimit,
        lastRowCount: accumulator.lastRowCount,
        lastTruncated: accumulator.lastTruncated,
        mappingTimeMs: toMeasurementSnapshot(accumulator.mappingTimeMs),
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
      staleCount: state.cache.staleCount,
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
