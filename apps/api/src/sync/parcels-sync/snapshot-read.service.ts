import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  ActiveExternalRunCandidate,
  ActiveRunMarker,
  MutableParcelsSyncStateProgress,
  ParsedLatestPointer,
  ParsedRunSummary,
} from "@/sync/parcels-sync/parcels-sync-runtime.types";
import {
  isRecord,
  parseNullableInteger,
  parseNullableIsoDatetime,
  parseNullableNonNegativeInteger,
  toIsoTimestampMs,
} from "@/sync/parcels-sync/value-parsing.service";
import type {
  ParcelsSyncPhase,
  ParcelsSyncRunProgress,
  ParcelsSyncRunReason,
} from "@/sync/parcels-sync.types";

const ACTIVE_EXTERNAL_RUN_STALE_MS = 20 * 60 * 1000;
const CHECKPOINT_FILE_RE = /^state-([A-Za-z0-9]+)\.checkpoint\.json$/;
const ACTIVE_RUN_MARKER_FILE = "active-run.json";
const RUN_PHASE_VALUES: readonly ParcelsSyncPhase[] = [
  "idle",
  "extracting",
  "loading",
  "building",
  "publishing",
  "completed",
  "failed",
];
const RUN_REASON_VALUES: readonly ParcelsSyncRunReason[] = [
  "startup",
  "interval",
  "manual",
  "unknown",
];

const TILE_BUILD_STAGE_VALUES: readonly ("build" | "convert" | "ready")[] = [
  "build",
  "convert",
  "ready",
];

function parseRunPhase(value: unknown, fallback: ParcelsSyncPhase): ParcelsSyncPhase {
  if (typeof value !== "string") {
    return fallback;
  }

  return RUN_PHASE_VALUES.find((phase) => phase === value) ?? fallback;
}

function parseRunReason(value: unknown): ParcelsSyncRunReason | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return RUN_REASON_VALUES.find((reason) => reason === normalized) ?? null;
}

function parseNullablePercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 100) {
    return null;
  }

  return value;
}

function parseNullableNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function parseActiveWorkers(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<string[]>((workers, entry) => {
    const normalized = parseNullableNonEmptyString(entry);
    if (normalized === null) {
      return workers;
    }

    workers.push(normalized);
    return workers;
  }, []);
}

function parseDbLoadProgress(value: unknown): ParcelsSyncRunProgress["dbLoad"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const stepKey = parseNullableNonEmptyString(Reflect.get(value, "stepKey"));
  if (stepKey === null) {
    return undefined;
  }

  const totalFilesRaw = parseNullableNonNegativeInteger(Reflect.get(value, "totalFiles"));
  const totalFiles = totalFilesRaw !== null && totalFilesRaw > 0 ? totalFilesRaw : null;
  return {
    stepKey,
    percent: parseNullablePercent(Reflect.get(value, "percent")),
    loadedFiles: parseNullableNonNegativeInteger(Reflect.get(value, "loadedFiles")),
    totalFiles,
    currentFile: parseNullableNonEmptyString(Reflect.get(value, "currentFile")),
    completedStates: parseNullableNonNegativeInteger(Reflect.get(value, "completedStates")),
    totalStates: parseNullableNonNegativeInteger(Reflect.get(value, "totalStates")),
    activeWorkers: parseActiveWorkers(Reflect.get(value, "activeWorkers")),
  };
}

function parseTileBuildProgress(value: unknown): ParcelsSyncRunProgress["tileBuild"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const stageRaw = Reflect.get(value, "stage");
  if (typeof stageRaw !== "string") {
    return undefined;
  }

  const stage = TILE_BUILD_STAGE_VALUES.find((candidate) => candidate === stageRaw);
  if (typeof stage === "undefined") {
    return undefined;
  }

  const convertAttemptRaw = parseNullableNonNegativeInteger(Reflect.get(value, "convertAttempt"));
  const convertAttempt =
    convertAttemptRaw !== null && convertAttemptRaw > 0 ? convertAttemptRaw : null;
  const convertAttemptTotalRaw = parseNullableNonNegativeInteger(
    Reflect.get(value, "convertAttemptTotal")
  );
  const convertAttemptTotal =
    convertAttemptTotalRaw !== null && convertAttemptTotalRaw > 0 ? convertAttemptTotalRaw : null;

  return {
    stage,
    percent: parseNullablePercent(Reflect.get(value, "percent")),
    logBytes: parseNullableNonNegativeInteger(Reflect.get(value, "logBytes")),
    readFeatures: parseNullableNonNegativeInteger(Reflect.get(value, "readFeatures")),
    totalFeatures: parseNullableNonNegativeInteger(Reflect.get(value, "totalFeatures")),
    workDone: parseNullableNonNegativeInteger(Reflect.get(value, "workDone")),
    workLeft: parseNullableNonNegativeInteger(Reflect.get(value, "workLeft")),
    workTotal: parseNullableNonNegativeInteger(Reflect.get(value, "workTotal")),
    convertPercent: parseNullablePercent(Reflect.get(value, "convertPercent")),
    convertDone: parseNullableNonNegativeInteger(Reflect.get(value, "convertDone")),
    convertTotal: parseNullableNonNegativeInteger(Reflect.get(value, "convertTotal")),
    convertAttempt,
    convertAttemptTotal,
  };
}

function parseRunProgress(
  value: unknown,
  fallbackPhase: ParcelsSyncPhase
): ParcelsSyncRunProgress | null {
  if (!isRecord(value)) {
    return null;
  }

  const schemaVersion = Reflect.get(value, "schemaVersion");
  if (schemaVersion !== 1) {
    return null;
  }

  const phase = parseRunPhase(Reflect.get(value, "phase"), fallbackPhase);
  const dbLoad = parseDbLoadProgress(Reflect.get(value, "dbLoad"));
  const tileBuild = parseTileBuildProgress(Reflect.get(value, "tileBuild"));
  return {
    schemaVersion: 1,
    phase,
    ...(typeof dbLoad === "undefined" ? {} : { dbLoad }),
    ...(typeof tileBuild === "undefined" ? {} : { tileBuild }),
  };
}

function parseStateProgressRecord(
  rawValue: unknown,
  fallbackState: string | null,
  fallbackUpdatedAt: string | null
): MutableParcelsSyncStateProgress | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  const rawState = Reflect.get(rawValue, "state");
  const state = typeof rawState === "string" && rawState.trim().length > 0 ? rawState.trim() : null;
  const resolvedState = state ?? fallbackState;
  if (resolvedState === null) {
    return null;
  }

  const expectedCount = parseNullableNonNegativeInteger(Reflect.get(rawValue, "expectedCount"));
  const pagesFetched = parseNullableNonNegativeInteger(Reflect.get(rawValue, "pagesFetched"));
  const writtenCount = parseNullableNonNegativeInteger(Reflect.get(rawValue, "writtenCount"));
  const lastSourceId = parseNullableInteger(Reflect.get(rawValue, "lastSourceId"));
  const isCompleted = Reflect.get(rawValue, "isCompleted") === true;

  if (pagesFetched === null || writtenCount === null) {
    return null;
  }

  const updatedAt =
    parseNullableIsoDatetime(Reflect.get(rawValue, "updatedAt")) ??
    parseNullableIsoDatetime(fallbackUpdatedAt);

  return {
    state: resolvedState,
    expectedCount,
    isCompleted,
    writtenCount,
    pagesFetched,
    lastSourceId,
    updatedAt,
  };
}

function compareStateProgress(
  left: MutableParcelsSyncStateProgress,
  right: MutableParcelsSyncStateProgress
): number {
  return left.state.localeCompare(right.state);
}

function readJsonFile(path: string): unknown | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = readFileSync(path, "utf8");
    if (raw.trim().length === 0) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    // Snapshot files can be missing or transiently malformed while an external sync process updates them.
    // The status endpoint should fail soft and keep serving the last known in-memory state.
    return null;
  }
}

export function readRunSummary(snapshotRoot: string, runId: string): ParsedRunSummary | null {
  const summaryPath = join(snapshotRoot, runId, "run-summary.json");
  const parsedSummary = readJsonFile(summaryPath);
  if (!isRecord(parsedSummary)) {
    return null;
  }

  const startedAt = parseNullableIsoDatetime(Reflect.get(parsedSummary, "startedAt"));
  const completedAt = parseNullableIsoDatetime(Reflect.get(parsedSummary, "completedAt"));
  const rawStates = Reflect.get(parsedSummary, "states");
  if (!Array.isArray(rawStates)) {
    return null;
  }

  const states = rawStates
    .map((rawState) => parseStateProgressRecord(rawState, null, completedAt))
    .filter((state): state is MutableParcelsSyncStateProgress => state !== null)
    .sort(compareStateProgress);

  return {
    startedAt,
    completedAt,
    states,
  };
}

export function readStateCheckpoints(
  snapshotRoot: string,
  runId: string
): readonly MutableParcelsSyncStateProgress[] {
  const runDirectory = join(snapshotRoot, runId);
  if (!existsSync(runDirectory)) {
    return [];
  }

  let entries: Dirent<string>[];
  try {
    entries = readdirSync(runDirectory, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(CHECKPOINT_FILE_RE);
      if (!match) {
        return null;
      }

      const stateCode = match[1];
      if (typeof stateCode !== "string" || stateCode.trim().length === 0) {
        return null;
      }

      const checkpointPath = join(runDirectory, entry.name);
      const parsedCheckpoint = readJsonFile(checkpointPath);
      return parseStateProgressRecord(parsedCheckpoint, stateCode, null);
    })
    .filter((state): state is MutableParcelsSyncStateProgress => state !== null)
    .sort(compareStateProgress);
}

export function readLatestPointer(snapshotRoot: string): ParsedLatestPointer {
  const pointerPath = join(snapshotRoot, "latest.json");
  const parsedPointer = readJsonFile(pointerPath);
  if (!isRecord(parsedPointer)) {
    return {
      runId: null,
      updatedAt: null,
    };
  }

  const rawRunId = Reflect.get(parsedPointer, "runId");
  const runId = typeof rawRunId === "string" && rawRunId.trim().length > 0 ? rawRunId.trim() : null;

  return {
    runId,
    updatedAt: parseNullableIsoDatetime(Reflect.get(parsedPointer, "updatedAt")),
  };
}

function readSnapshotDirectories(snapshotRoot: string): Dirent<string>[] {
  if (!existsSync(snapshotRoot)) {
    return [];
  }

  try {
    return readdirSync(snapshotRoot, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return [];
  }
}

export function readActiveRunMarker(snapshotRoot: string): ActiveRunMarker | null {
  const markerPath = join(snapshotRoot, ACTIVE_RUN_MARKER_FILE);
  if (!existsSync(markerPath)) {
    return null;
  }

  const markerRaw = readJsonFile(markerPath);
  if (!isRecord(markerRaw)) {
    return null;
  }

  const runIdRaw = Reflect.get(markerRaw, "runId");
  if (typeof runIdRaw !== "string" || runIdRaw.trim().length === 0) {
    return null;
  }
  const runId = runIdRaw.trim();

  const phase = parseRunPhase(Reflect.get(markerRaw, "phase"), "idle");

  const isRunning = Reflect.get(markerRaw, "isRunning") === true;
  const updatedAt = parseNullableIsoDatetime(Reflect.get(markerRaw, "updatedAt"));

  const summaryRaw = Reflect.get(markerRaw, "summary");
  const summary =
    typeof summaryRaw === "string" && summaryRaw.trim().length > 0 ? summaryRaw.trim() : null;
  const progress = parseRunProgress(Reflect.get(markerRaw, "progress"), phase);
  const reason = parseRunReason(Reflect.get(markerRaw, "reason"));

  return {
    runId,
    phase,
    isRunning,
    updatedAt,
    reason,
    summary,
    progress,
  };
}

export function detectActiveExternalRun(snapshotRoot: string): ActiveExternalRunCandidate | null {
  const nowMs = Date.now();
  const entries = readSnapshotDirectories(snapshotRoot);
  return entries.reduce<ActiveExternalRunCandidate | null>((selected, entry) => {
    if (!entry.isDirectory()) {
      return selected;
    }

    const runId = entry.name.trim();
    if (runId.length === 0) {
      return selected;
    }

    const summary = readRunSummary(snapshotRoot, runId);
    if (summary !== null) {
      return selected;
    }

    const checkpointStates = readStateCheckpoints(snapshotRoot, runId);
    if (checkpointStates.length === 0) {
      return selected;
    }

    const touchedAtMsFromStates = checkpointStates.reduce((maxTouchedAtMs, state) => {
      const updatedAtMs = toIsoTimestampMs(state.updatedAt);
      return updatedAtMs === null ? maxTouchedAtMs : Math.max(maxTouchedAtMs, updatedAtMs);
    }, 0);

    const touchedAtMs =
      touchedAtMsFromStates > 0
        ? touchedAtMsFromStates
        : (() => {
            try {
              return statSync(join(snapshotRoot, runId)).mtimeMs;
            } catch {
              return 0;
            }
          })();

    if (touchedAtMs <= 0 || nowMs - touchedAtMs > ACTIVE_EXTERNAL_RUN_STALE_MS) {
      return selected;
    }

    const candidate: ActiveExternalRunCandidate = {
      runId,
      checkpointStates,
      touchedAtMs,
    };

    if (selected === null || candidate.touchedAtMs > selected.touchedAtMs) {
      return candidate;
    }

    return selected;
  }, null);
}
