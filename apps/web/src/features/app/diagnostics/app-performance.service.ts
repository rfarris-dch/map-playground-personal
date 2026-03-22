import type {
  AppPerformanceCounterSnapshot,
  AppPerformanceDebugApi,
  AppPerformanceMeasurementSnapshot,
  AppPerformanceSnapshot,
} from "@/features/app/diagnostics/app-performance.types";

type AppPerformanceTagValue = boolean | number | string | null | undefined;

interface NormalizedTagsResult {
  readonly key: string;
  readonly tags: Readonly<Record<string, string>>;
}

declare global {
  interface Window {
    __MAP_APP_PERFORMANCE__?: AppPerformanceDebugApi;
  }
}

const counters = new Map<string, AppPerformanceCounterSnapshot>();
const measurements = new Map<string, AppPerformanceMeasurementSnapshot>();
let lastResetAt = new Date().toISOString();

function nowIsoString(): string {
  return new Date().toISOString();
}

function performanceNow(): number {
  return globalThis.performance.now();
}

function normalizeTags(
  tags: Readonly<Record<string, AppPerformanceTagValue>> | undefined
): NormalizedTagsResult {
  if (typeof tags === "undefined") {
    return {
      key: "",
      tags: {},
    };
  }

  const entries = Object.entries(tags)
    .filter(([, value]) => value !== null && typeof value !== "undefined")
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return {
    key: entries.map(([key, value]) => `${key}=${value}`).join(","),
    tags: Object.fromEntries(entries),
  };
}

function buildMetricKey(name: string, tagsKey: string): string {
  return tagsKey.length > 0 ? `${name}|${tagsKey}` : name;
}

function cloneCounterSnapshots(): Record<string, AppPerformanceCounterSnapshot> {
  return Object.fromEntries(counters.entries());
}

function cloneMeasurementSnapshots(): Record<string, AppPerformanceMeasurementSnapshot> {
  return Object.fromEntries(measurements.entries());
}

function installDebugApi(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.__MAP_APP_PERFORMANCE__ = {
    getSnapshot,
    reset: resetAppPerformanceSnapshot,
  };
}

export function resetAppPerformanceSnapshot(): void {
  counters.clear();
  measurements.clear();
  lastResetAt = nowIsoString();
}

export function getSnapshot(): AppPerformanceSnapshot {
  return {
    counters: cloneCounterSnapshots(),
    generatedAt: nowIsoString(),
    lastResetAt,
    measurements: cloneMeasurementSnapshots(),
    status: "ok",
  };
}

export function recordAppPerformanceCounter(
  name: string,
  tags?: Readonly<Record<string, AppPerformanceTagValue>>,
  increment = 1
): void {
  const normalized = normalizeTags(tags);
  const key = buildMetricKey(name, normalized.key);
  const current = counters.get(key);

  counters.set(key, {
    count: (current?.count ?? 0) + increment,
    key,
    lastRecordedAt: nowIsoString(),
    lastValue: increment,
    name,
    tags: normalized.tags,
  });
}

export function recordAppPerformanceMeasurement(
  name: string,
  value: number,
  tags?: Readonly<Record<string, AppPerformanceTagValue>>
): void {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = normalizeTags(tags);
  const key = buildMetricKey(name, normalized.key);
  const current = measurements.get(key);
  const nextCount = (current?.count ?? 0) + 1;
  const nextTotal = (current?.total ?? 0) + value;

  measurements.set(key, {
    average: nextTotal / nextCount,
    count: nextCount,
    key,
    lastRecordedAt: nowIsoString(),
    lastValue: value,
    max: current === undefined ? value : Math.max(current.max, value),
    min: current === undefined ? value : Math.min(current.min, value),
    name,
    tags: normalized.tags,
    total: nextTotal,
  });
}

export function createAppPerformanceTimer(
  name: string,
  tags?: Readonly<Record<string, AppPerformanceTagValue>>
): () => void {
  const startedAt = performanceNow();
  return () => {
    recordAppPerformanceMeasurement(name, performanceNow() - startedAt, tags);
  };
}

installDebugApi();
