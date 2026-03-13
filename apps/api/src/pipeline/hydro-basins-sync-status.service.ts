import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type {
  ParcelSyncPhase,
  ParcelSyncRunReason,
  ParcelsSyncStatusResponse,
} from "@map-migration/contracts";
import { defaultSnapshotRootForDataset } from "@map-migration/ops/etl/project-paths";

interface RunPointerRecord {
  readonly completedAt?: unknown;
  readonly runDir?: unknown;
  readonly runId?: unknown;
}

interface ActiveRunRecord {
  readonly isRunning?: unknown;
  readonly phase?: unknown;
  readonly reason?: unknown;
  readonly runId?: unknown;
  readonly startedAt?: unknown;
  readonly summary?: unknown;
  readonly updatedAt?: unknown;
}

interface MarkerRecord {
  readonly completedAt?: unknown;
}

interface RunSummaryRecord {
  readonly completedAt?: unknown;
  readonly runId?: unknown;
}

const HYDRO_DATASET = "environmental-hydro-basins";
const HYDRO_BUILD_LOG_MAX_BYTES = 32_768;
const HYDRO_ACTIVE_STALE_MS = 120_000;
const HYDRO_INTERVAL_MS = 604_800_000;
const HYDRO_LOG_SPLIT_PATTERN = /\r?\n/u;
const HYDRO_RUNNING_PHASES: readonly [string, ParcelSyncPhase][] = [
  ["extracting", "extracting"],
  ["normalizing", "extracting"],
  ["loading", "loading"],
  ["building", "building"],
  ["publishing", "publishing"],
  ["completed", "completed"],
  ["failed", "failed"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = readFileSync(path, "utf8");
    if (raw.trim().length === 0) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readFileTail(path: string, maxBytes: number): string[] {
  if (!existsSync(path)) {
    return [];
  }

  const size = statSync(path).size;
  const bytesToRead = Math.min(size, maxBytes);
  const fileDescriptor = openSync(path, "r");

  try {
    const buffer = Buffer.alloc(bytesToRead);
    const startOffset = Math.max(0, size - bytesToRead);
    const bytesRead = readSync(fileDescriptor, buffer, 0, bytesToRead, startOffset);
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    return text
      .split(HYDRO_LOG_SPLIT_PATTERN)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-20);
  } finally {
    closeSync(fileDescriptor);
  }
}

function parsePointerRecord(value: Record<string, unknown> | null): RunPointerRecord | null {
  return value;
}

function parseActiveRunRecord(value: Record<string, unknown> | null): ActiveRunRecord | null {
  return value;
}

function parseMarkerRecord(value: Record<string, unknown> | null): MarkerRecord | null {
  return value;
}

function parseRunSummaryRecord(value: Record<string, unknown> | null): RunSummaryRecord | null {
  return value;
}

function resolveSnapshotRoot(): string {
  return resolve(defaultSnapshotRootForDataset(HYDRO_DATASET, process.env));
}

function listCandidateRunIds(snapshotRoot: string): readonly string[] {
  if (!existsSync(snapshotRoot)) {
    return [];
  }

  return readdirSync(snapshotRoot, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name !== "sync.lock")
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));
}

function resolveLatestRunId(snapshotRoot: string): string | null {
  const latestPointer = parsePointerRecord(readJsonFile(join(snapshotRoot, "latest.json")));
  const latestRunId = readNullableString(latestPointer?.runId);
  if (latestRunId !== null) {
    return latestRunId;
  }

  return listCandidateRunIds(snapshotRoot)[0] ?? null;
}

function isActiveRunFresh(activeRun: ActiveRunRecord | null): boolean {
  if (readNullableBoolean(activeRun?.isRunning) !== true) {
    return false;
  }

  const updatedAt = readNullableString(activeRun?.updatedAt);
  if (updatedAt === null) {
    return false;
  }

  const updatedAtMs = Date.parse(updatedAt);
  return Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs <= HYDRO_ACTIVE_STALE_MS;
}

function resolveActiveRunId(snapshotRoot: string): string | null {
  for (const runId of listCandidateRunIds(snapshotRoot)) {
    const activeRun = parseActiveRunRecord(
      readJsonFile(join(snapshotRoot, runId, "active-run.json"))
    );
    if (isActiveRunFresh(activeRun)) {
      return runId;
    }
  }

  return null;
}

function normalizePhase(value: string | null): ParcelSyncPhase {
  if (value !== null) {
    for (const [rawPhase, normalizedPhase] of HYDRO_RUNNING_PHASES) {
      if (value === rawPhase) {
        return normalizedPhase;
      }
    }
  }

  return "idle";
}

function computeDurationMs(startedAt: string | null, endedAt: string | null): number | null {
  if (startedAt === null || endedAt === null) {
    return null;
  }

  const startedAtMs = Date.parse(startedAt);
  const endedAtMs = Date.parse(endedAt);
  if (!(Number.isFinite(startedAtMs) && Number.isFinite(endedAtMs)) || endedAtMs < startedAtMs) {
    return null;
  }

  return endedAtMs - startedAtMs;
}

function normalizeReason(value: string | null): ParcelSyncRunReason {
  if (value === "startup" || value === "interval" || value === "manual" || value === "unknown") {
    return value;
  }

  return "manual";
}

function createIdleHydroStatus(snapshotRoot: string): ParcelsSyncStatusResponse {
  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    enabled: true,
    mode: "external",
    intervalMs: HYDRO_INTERVAL_MS,
    requireStartupSuccess: false,
    snapshotRoot,
    latestRunId: null,
    latestRunCompletedAt: null,
    run: {
      runId: null,
      reason: null,
      phase: "idle",
      isRunning: false,
      startedAt: null,
      endedAt: null,
      durationMs: null,
      exitCode: null,
      summary: null,
      progress: null,
      states: [],
      statesCompleted: 0,
      statesTotal: 0,
      writtenCount: 0,
      expectedCount: null,
      logTail: [],
    },
  };
}

function resolveHydroPhase(
  isRunning: boolean,
  activeRun: ActiveRunRecord | null,
  publishComplete: MarkerRecord | null,
  buildComplete: MarkerRecord | null,
  loadComplete: MarkerRecord | null,
  normalizeComplete: MarkerRecord | null,
  runSummary: RunSummaryRecord | null
): ParcelSyncPhase {
  if (isRunning) {
    return normalizePhase(readNullableString(activeRun?.phase));
  }

  if (publishComplete !== null) {
    return "completed";
  }

  if (buildComplete !== null) {
    return "building";
  }

  if (loadComplete !== null) {
    return "loading";
  }

  if (normalizeComplete !== null || runSummary !== null) {
    return "extracting";
  }

  return "idle";
}

function buildHydroStates(
  runSummary: RunSummaryRecord | null,
  normalizeComplete: MarkerRecord | null,
  loadComplete: MarkerRecord | null,
  buildComplete: MarkerRecord | null,
  publishComplete: MarkerRecord | null
): ParcelsSyncStatusResponse["run"]["states"] {
  return [
    {
      state: "extract",
      expectedCount: null,
      writtenCount: runSummary !== null ? 1 : 0,
      pagesFetched: runSummary !== null ? 1 : 0,
      lastSourceId: null,
      updatedAt: readNullableString(runSummary?.completedAt),
      isCompleted: runSummary !== null,
    },
    {
      state: "normalize",
      expectedCount: null,
      writtenCount: normalizeComplete !== null ? 1 : 0,
      pagesFetched: normalizeComplete !== null ? 1 : 0,
      lastSourceId: null,
      updatedAt: readNullableString(normalizeComplete?.completedAt),
      isCompleted: normalizeComplete !== null,
    },
    {
      state: "load",
      expectedCount: null,
      writtenCount: loadComplete !== null ? 1 : 0,
      pagesFetched: loadComplete !== null ? 1 : 0,
      lastSourceId: null,
      updatedAt: readNullableString(loadComplete?.completedAt),
      isCompleted: loadComplete !== null,
    },
    {
      state: "build",
      expectedCount: null,
      writtenCount: buildComplete !== null ? 1 : 0,
      pagesFetched: buildComplete !== null ? 1 : 0,
      lastSourceId: null,
      updatedAt: readNullableString(buildComplete?.completedAt),
      isCompleted: buildComplete !== null,
    },
    {
      state: "publish",
      expectedCount: null,
      writtenCount: publishComplete !== null ? 1 : 0,
      pagesFetched: publishComplete !== null ? 1 : 0,
      lastSourceId: null,
      updatedAt: readNullableString(publishComplete?.completedAt),
      isCompleted: publishComplete !== null,
    },
  ];
}

function buildHydroProgress(
  phase: ParcelSyncPhase,
  buildComplete: MarkerRecord | null,
  logTail: readonly string[]
): ParcelsSyncStatusResponse["run"]["progress"] {
  if (phase !== "building") {
    return null;
  }

  return {
    schemaVersion: 1,
    phase,
    tileBuild: {
      stage: buildComplete !== null ? "ready" : "build",
      logBytes: logTail.join("\n").length,
    },
  };
}

function readHydroRunArtifacts(snapshotRoot: string, runId: string) {
  const runDir = join(snapshotRoot, runId);

  return {
    activeRun: parseActiveRunRecord(readJsonFile(join(runDir, "active-run.json"))),
    runSummary: parseRunSummaryRecord(readJsonFile(join(runDir, "run-summary.json"))),
    normalizeComplete: parseMarkerRecord(readJsonFile(join(runDir, "normalize-complete.json"))),
    loadComplete: parseMarkerRecord(readJsonFile(join(runDir, "load-complete.json"))),
    buildComplete: parseMarkerRecord(readJsonFile(join(runDir, "tile-build-complete.json"))),
    publishComplete: parseMarkerRecord(readJsonFile(join(runDir, "publish-complete.json"))),
    logTail: readFileTail(join(runDir, `postextract-${runId}.log`), HYDRO_BUILD_LOG_MAX_BYTES),
  };
}

export function getHydroBasinsSyncStatusSnapshot(): ParcelsSyncStatusResponse {
  const snapshotRoot = resolveSnapshotRoot();
  const activeRunId = resolveActiveRunId(snapshotRoot);
  const latestRunId = resolveLatestRunId(snapshotRoot);
  const selectedRunId = activeRunId ?? latestRunId;

  if (selectedRunId === null) {
    return createIdleHydroStatus(snapshotRoot);
  }

  const {
    activeRun,
    runSummary,
    normalizeComplete,
    loadComplete,
    buildComplete,
    publishComplete,
    logTail,
  } = readHydroRunArtifacts(snapshotRoot, selectedRunId);
  const latestPointer = parsePointerRecord(readJsonFile(join(snapshotRoot, "latest.json")));

  const startedAt = readNullableString(activeRun?.startedAt);
  const endedAt =
    readNullableString(publishComplete?.completedAt) ?? readNullableString(runSummary?.completedAt);
  const isRunning = activeRunId === selectedRunId && isActiveRunFresh(activeRun);
  const phase = resolveHydroPhase(
    isRunning,
    activeRun,
    publishComplete,
    buildComplete,
    loadComplete,
    normalizeComplete,
    runSummary
  );
  const states = buildHydroStates(
    runSummary,
    normalizeComplete,
    loadComplete,
    buildComplete,
    publishComplete
  );
  const statesCompleted = states.filter((state) => state.isCompleted).length;

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    enabled: true,
    mode: "external",
    intervalMs: HYDRO_INTERVAL_MS,
    requireStartupSuccess: false,
    snapshotRoot,
    latestRunId,
    latestRunCompletedAt: readNullableString(latestPointer?.completedAt),
    run: {
      runId:
        readNullableString(activeRun?.runId) ??
        readNullableString(runSummary?.runId) ??
        selectedRunId,
      reason: normalizeReason(readNullableString(activeRun?.reason)),
      phase,
      isRunning,
      startedAt,
      endedAt,
      durationMs: computeDurationMs(startedAt, endedAt),
      exitCode: phase === "failed" ? 1 : 0,
      summary:
        readNullableString(activeRun?.summary) ??
        (publishComplete !== null ? "manifest-published" : null),
      progress: buildHydroProgress(phase, buildComplete, logTail),
      states,
      statesCompleted,
      statesTotal: states.length,
      writtenCount: statesCompleted,
      expectedCount: states.length,
      logTail,
    },
  };
}
