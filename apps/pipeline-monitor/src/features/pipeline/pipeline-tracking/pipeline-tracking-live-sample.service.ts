import type { PipelineLiveSample, PipelineStatusPayload } from "@/features/pipeline/pipeline.types";
import { parseIsoToTimestamp } from "@/features/pipeline/pipeline-tracking/pipeline-tracking-time.service";
import type { ParsedBuildSummary } from "./pipeline-tracking-live-sample.service.types";

const BUILD_PERCENT_RE = /([0-9]+(?:\.[0-9]+)?)%/;
const BUILD_READ_RE = /\bread=([0-9]+)\/([0-9]+)\b/;
const BUILD_LOG_BYTES_RE = /\blog=([0-9]+)\b/;

function isStateCompleted(state: unknown): boolean {
  if (typeof state !== "object" || state === null) {
    return false;
  }

  return Reflect.get(state, "isCompleted") === true;
}

function normalizeStateExpectedCount(
  state: PipelineStatusPayload["response"]["run"]["states"][number]
): number | null {
  if (typeof state.expectedCount !== "number") {
    return null;
  }

  if (isStateCompleted(state) && state.expectedCount > state.writtenCount) {
    return state.writtenCount;
  }

  return state.expectedCount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBuildSummaryFromStructured(progress: unknown): ParsedBuildSummary | null {
  if (!isRecord(progress)) {
    return null;
  }

  const tileBuild = Reflect.get(progress, "tileBuild");
  if (!isRecord(tileBuild)) {
    return null;
  }

  const percentRaw = Reflect.get(tileBuild, "percent");
  const percent =
    typeof percentRaw === "number" &&
    Number.isFinite(percentRaw) &&
    percentRaw >= 0 &&
    percentRaw <= 100
      ? percentRaw
      : null;
  const logBytesRaw = Reflect.get(tileBuild, "logBytes");
  const logBytes =
    typeof logBytesRaw === "number" &&
    Number.isFinite(logBytesRaw) &&
    Number.isInteger(logBytesRaw) &&
    logBytesRaw >= 0
      ? logBytesRaw
      : null;

  return {
    percent,
    logBytes,
  };
}

function parseBuildSummary(
  summary: string | null | undefined,
  progress?: unknown
): ParsedBuildSummary | null {
  const structured = parseBuildSummaryFromStructured(progress);
  if (structured !== null) {
    return structured;
  }

  if (typeof summary !== "string") {
    return null;
  }

  const normalized = summary.trim();
  if (!(normalized.startsWith("tiles:building") || normalized.startsWith("tiles:converting"))) {
    return null;
  }

  const percentMatch = BUILD_PERCENT_RE.exec(normalized);
  let percent: number | null = null;
  if (percentMatch?.[1]) {
    const parsedPercent = Number.parseFloat(percentMatch[1]);
    if (Number.isFinite(parsedPercent) && parsedPercent >= 0 && parsedPercent <= 100) {
      percent = parsedPercent;
    }
  }

  if (percent === null) {
    const readMatch = BUILD_READ_RE.exec(normalized);
    const readRaw = readMatch?.[1];
    const totalRaw = readMatch?.[2];
    if (typeof readRaw === "string" && typeof totalRaw === "string") {
      const readCount = Number.parseInt(readRaw, 10);
      const totalCount = Number.parseInt(totalRaw, 10);
      if (
        Number.isFinite(readCount) &&
        readCount >= 0 &&
        Number.isFinite(totalCount) &&
        totalCount > 0
      ) {
        percent = Math.max(0, Math.min(99.9, (readCount / totalCount) * 100));
      }
    }
  }

  const logBytesMatch = BUILD_LOG_BYTES_RE.exec(normalized);
  let logBytes: number | null = null;
  if (logBytesMatch?.[1]) {
    const parsedLogBytes = Number.parseInt(logBytesMatch[1], 10);
    if (Number.isFinite(parsedLogBytes) && parsedLogBytes >= 0) {
      logBytes = parsedLogBytes;
    }
  }

  return {
    percent,
    logBytes,
  };
}

function deriveRunProgressTotals(run: PipelineStatusPayload["response"]["run"]): {
  readonly expectedCount: number | null;
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly writtenCount: number;
} {
  let writtenCount = 0;
  let expectedCount = 0;
  let statesCompleted = 0;
  let hasExpectedGap = false;

  for (const state of run.states) {
    writtenCount += state.writtenCount;

    const normalizedExpected = normalizeStateExpectedCount(state);
    if (normalizedExpected === null) {
      hasExpectedGap = true;
    } else {
      expectedCount += normalizedExpected;
    }

    if (
      isStateCompleted(state) ||
      (normalizedExpected !== null && state.writtenCount >= normalizedExpected)
    ) {
      statesCompleted += 1;
    }
  }

  return {
    writtenCount,
    expectedCount: hasExpectedGap ? null : expectedCount,
    statesCompleted,
    statesTotal: run.states.length,
  };
}

function findLatestStateUpdatedAt(payload: PipelineStatusPayload): string | null {
  const states = payload.response.run.states;
  let latestTimestampMs: number | null = null;
  let latestIso: string | null = null;

  for (const state of states) {
    const stateUpdatedAt = state.updatedAt;
    if (typeof stateUpdatedAt !== "string") {
      continue;
    }

    const timestampMs = parseIsoToTimestamp(stateUpdatedAt);
    if (timestampMs === null) {
      continue;
    }

    if (latestTimestampMs === null || timestampMs > latestTimestampMs) {
      latestTimestampMs = timestampMs;
      latestIso = new Date(timestampMs).toISOString();
    }
  }

  return latestIso;
}

export function buildPipelineLiveSample(
  payload: PipelineStatusPayload,
  capturedAt: string
): PipelineLiveSample {
  const run = payload.response.run;
  const progressTotals = deriveRunProgressTotals(run);
  const runProgress =
    typeof run === "object" && run !== null ? Reflect.get(run, "progress") : undefined;
  const buildSummary = parseBuildSummary(run.summary, runProgress);
  return {
    buildLogBytes: buildSummary?.logBytes ?? null,
    buildProgressPercent: buildSummary?.percent ?? null,
    capturedAt,
    requestId: payload.requestId,
    runId: run.runId,
    phase: run.phase,
    isRunning: run.isRunning,
    statesCompleted: progressTotals.statesCompleted,
    statesTotal: progressTotals.statesTotal,
    writtenCount: progressTotals.writtenCount,
    expectedCount: progressTotals.expectedCount,
    runStartedAt: run.startedAt,
    lastStateUpdatedAt: findLatestStateUpdatedAt(payload),
  };
}
