import { buildAppPerformanceDebugRoute } from "@map-migration/http-contracts/api-routes";
import type { AppPerformanceExportRequest } from "@map-migration/http-contracts/app-performance-http";
import type {
  AppPerformanceCounterSnapshot,
  AppPerformanceDebugApi,
  AppPerformanceMeasurementSnapshot,
  AppPerformanceSnapshot,
} from "@/features/app/diagnostics/app-performance.types";
import { buildJsonPostRequestInit } from "@/lib/api/api-request-init.service";

type AppPerformanceTagValue = boolean | number | string | null | undefined;

interface NormalizedTagsResult {
  readonly key: string;
  readonly tags: Readonly<Record<string, string>>;
}

interface ActiveLongTaskWindow {
  readonly expiresAtMs: number;
  readonly startedAtMs: number;
  readonly tags: Readonly<Record<string, string>>;
}

declare global {
  interface Window {
    __MAP_APP_PERFORMANCE__?: AppPerformanceDebugApi;
  }
}

const counters = new Map<string, AppPerformanceCounterSnapshot>();
const measurements = new Map<string, AppPerformanceMeasurementSnapshot>();
const APP_PERFORMANCE_EXPORT_INTERVAL_MS = 15_000;
const appPerformanceSessionStorageKey = "map:app-performance-session-id";
let lastResetAt = new Date().toISOString();
let activeLongTaskWindow: ActiveLongTaskWindow | null = null;
let appPerformanceExportDirty = false;
let appPerformanceExportInFlight = false;
let appPerformanceExportTimer: ReturnType<typeof setTimeout> | null = null;
let appPerformanceRuntimeInstalled = false;
let appPerformanceSessionId: string | null = null;

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

function readPerformanceNow(): number {
  return performanceNow();
}

function clearScheduledAppPerformanceExport(): void {
  if (appPerformanceExportTimer === null) {
    return;
  }

  globalThis.clearTimeout(appPerformanceExportTimer);
  appPerformanceExportTimer = null;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAppPerformanceSessionId(): string {
  if (appPerformanceSessionId !== null) {
    return appPerformanceSessionId;
  }

  if (typeof window === "undefined") {
    appPerformanceSessionId = "server";
    return appPerformanceSessionId;
  }

  const existing = window.sessionStorage.getItem(appPerformanceSessionStorageKey);
  if (typeof existing === "string" && existing.trim().length > 0) {
    appPerformanceSessionId = existing;
    return appPerformanceSessionId;
  }

  const nextSessionId = createSessionId();
  window.sessionStorage.setItem(appPerformanceSessionStorageKey, nextSessionId);
  appPerformanceSessionId = nextSessionId;
  return nextSessionId;
}

function buildAppPerformanceExportRequest(): AppPerformanceExportRequest | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payload: AppPerformanceExportRequest = {
    pathname: `${window.location.pathname}${window.location.search}`,
    sampledAt: nowIsoString(),
    sessionId: readAppPerformanceSessionId(),
    snapshot: getSnapshot(),
  };

  const userAgent = window.navigator.userAgent.trim();
  if (userAgent.length > 0) {
    payload.userAgent = userAgent;
  }

  const visibilityState = document.visibilityState.trim();
  if (visibilityState.length > 0) {
    payload.visibilityState = visibilityState;
  }

  return payload;
}

function trySendAppPerformanceBeacon(payload: AppPerformanceExportRequest): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  const beaconBody = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  return navigator.sendBeacon(buildAppPerformanceDebugRoute(), beaconBody);
}

async function postAppPerformanceSnapshot(payload: AppPerformanceExportRequest): Promise<boolean> {
  const response = await fetch(
    buildAppPerformanceDebugRoute(),
    buildJsonPostRequestInit({
      body: payload,
    })
  );

  return response.ok;
}

function flushAppPerformanceSnapshot(useBeacon: boolean): void {
  if (appPerformanceExportInFlight || !appPerformanceExportDirty) {
    return;
  }

  const payload = buildAppPerformanceExportRequest();
  if (payload === null) {
    return;
  }

  clearScheduledAppPerformanceExport();

  if (useBeacon && trySendAppPerformanceBeacon(payload)) {
    appPerformanceExportDirty = false;
    return;
  }

  appPerformanceExportInFlight = true;
  postAppPerformanceSnapshot(payload)
    .then((ok) => {
      if (ok) {
        appPerformanceExportDirty = false;
      }
    })
    .catch(() => undefined)
    .finally(() => {
      appPerformanceExportInFlight = false;
      if (appPerformanceExportDirty) {
        scheduleAppPerformanceExport();
      }
    });
}

function scheduleAppPerformanceExport(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (appPerformanceExportTimer !== null || appPerformanceExportInFlight) {
    return;
  }

  appPerformanceExportTimer = globalThis.setTimeout(() => {
    appPerformanceExportTimer = null;
    flushAppPerformanceSnapshot(false);
  }, APP_PERFORMANCE_EXPORT_INTERVAL_MS);
}

function markAppPerformanceDirty(): void {
  appPerformanceExportDirty = true;
  scheduleAppPerformanceExport();
}

function maybeReadActiveLongTaskWindowTags(
  entryStartTimeMs: number,
  entryDurationMs: number
): Readonly<Record<string, string>> | undefined {
  if (activeLongTaskWindow === null) {
    return undefined;
  }

  const entryEndTimeMs = entryStartTimeMs + entryDurationMs;
  if (
    entryEndTimeMs < activeLongTaskWindow.startedAtMs ||
    entryStartTimeMs > activeLongTaskWindow.expiresAtMs
  ) {
    return undefined;
  }

  return activeLongTaskWindow.tags;
}

function installLongTaskObserver(): void {
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined" ||
    !Array.isArray(PerformanceObserver.supportedEntryTypes) ||
    !PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    return;
  }

  const observer = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      const tags = maybeReadActiveLongTaskWindowTags(entry.startTime, entry.duration);
      recordAppPerformanceCounter("app.long-task.count", tags);
      recordAppPerformanceMeasurement("app.long-task.duration", entry.duration, tags);
    }
  });

  observer.observe({
    entryTypes: ["longtask"],
  });
}

function installAppPerformanceRuntime(): void {
  if (appPerformanceRuntimeInstalled || typeof window === "undefined") {
    return;
  }

  appPerformanceRuntimeInstalled = true;
  installLongTaskObserver();

  window.addEventListener("pagehide", () => {
    flushAppPerformanceSnapshot(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAppPerformanceSnapshot(true);
    }
  });
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
  activeLongTaskWindow = null;
  appPerformanceExportDirty = false;
  clearScheduledAppPerformanceExport();
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
  installAppPerformanceRuntime();
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
  markAppPerformanceDirty();
}

export function recordAppPerformanceMeasurement(
  name: string,
  value: number,
  tags?: Readonly<Record<string, AppPerformanceTagValue>>
): void {
  installAppPerformanceRuntime();
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
  markAppPerformanceDirty();
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

export function openAppPerformanceLongTaskWindow(
  tags: Readonly<Record<string, AppPerformanceTagValue>>,
  durationMs = 2000
): void {
  installAppPerformanceRuntime();

  const normalized = normalizeTags(tags);
  const startedAtMs = readPerformanceNow();
  activeLongTaskWindow = {
    expiresAtMs: startedAtMs + durationMs,
    startedAtMs,
    tags: normalized.tags,
  };
}

installDebugApi();
