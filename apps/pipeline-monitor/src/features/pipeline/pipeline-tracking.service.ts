import type {
  PipelineFetchFailure,
  PipelineLiveEvent,
  PipelineLiveSample,
  PipelineStatusPayload,
} from "./pipeline.types";

const LIVE_SAMPLE_LIMIT = 240;
const LIVE_EVENT_LIMIT = 300;
const BUILD_PERCENT_RE = /([0-9]+(?:\.[0-9]+)?)%/;
const BUILD_READ_RE = /\bread=([0-9]+)\/([0-9]+)\b/;
const BUILD_LOG_BYTES_RE = /\blog=([0-9]+)\b/;

interface PipelineRateEstimate {
  readonly averageRowsPerSecond: number | null;
  readonly etaMs: number | null;
  readonly rateBasis: "average" | "recent" | null;
  readonly recentRowsPerSecond: number | null;
  readonly remainingRows: number | null;
  readonly rowsPerSecond: number | null;
  readonly stalledMs: number | null;
}

interface PipelineBuildEstimate {
  readonly averagePercentPerSecond: number | null;
  readonly etaMs: number | null;
  readonly percentPerSecond: number | null;
  readonly rateBasis: "average" | "recent" | null;
  readonly recentPercentPerSecond: number | null;
  readonly remainingPercent: number | null;
  readonly stalledMs: number | null;
}

function isStateCompleted(state: unknown): boolean {
  if (typeof state !== "object" || state === null) {
    return false;
  }

  return Reflect.get(state, "isCompleted") === true;
}

function appendWithLimit<T>(
  current: readonly T[],
  incoming: readonly T[],
  limit: number
): readonly T[] {
  if (incoming.length === 0) {
    return current;
  }

  const merged = [...current, ...incoming];
  if (merged.length <= limit) {
    return merged;
  }

  return merged.slice(merged.length - limit);
}

function parseIsoToTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseNullableIsoToTimestamp(value: string | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  return parseIsoToTimestamp(value);
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

function buildEventToneFromPhase(phase: PipelineLiveSample["phase"]): PipelineLiveEvent["tone"] {
  if (phase === "failed") {
    return "critical";
  }

  if (phase === "completed") {
    return "success";
  }

  return "info";
}

function buildRequestFailureMessage(error: PipelineFetchFailure): string {
  if (typeof error.status === "number") {
    return `Request failed (${String(error.status)}): ${error.message}`;
  }

  return `Request failed: ${error.message}`;
}

export function appendPipelineLiveSample(
  history: readonly PipelineLiveSample[],
  nextSample: PipelineLiveSample
): readonly PipelineLiveSample[] {
  return appendWithLimit(history, [nextSample], LIVE_SAMPLE_LIMIT);
}

export function appendPipelineLiveEvents(
  current: readonly PipelineLiveEvent[],
  incoming: readonly PipelineLiveEvent[]
): readonly PipelineLiveEvent[] {
  return appendWithLimit(current, incoming, LIVE_EVENT_LIMIT);
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

interface ParsedBuildSummary {
  readonly logBytes: number | null;
  readonly percent: number | null;
}

function parseBuildSummary(summary: string | null | undefined): ParsedBuildSummary | null {
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

export function buildPipelineLiveSample(
  payload: PipelineStatusPayload,
  capturedAt: string
): PipelineLiveSample {
  const run = payload.response.run;
  const progressTotals = deriveRunProgressTotals(run);
  const buildSummary = parseBuildSummary(run.summary);
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

export function buildPipelineLiveEvents(
  previousSample: PipelineLiveSample | null,
  nextSample: PipelineLiveSample
): readonly PipelineLiveEvent[] {
  const events: PipelineLiveEvent[] = [];

  if (previousSample === null) {
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "info",
      message: `Connected to status feed (run=${nextSample.runId ?? "n/a"}, phase=${nextSample.phase})`,
    });
    return events;
  }

  if (previousSample.runId !== nextSample.runId) {
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "info",
      message: `Run changed: ${previousSample.runId ?? "n/a"} -> ${nextSample.runId ?? "n/a"}`,
    });
  }

  if (previousSample.phase !== nextSample.phase) {
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: buildEventToneFromPhase(nextSample.phase),
      message: `Phase changed: ${previousSample.phase} -> ${nextSample.phase}`,
    });
  }

  if (nextSample.statesCompleted > previousSample.statesCompleted) {
    const completedDelta = nextSample.statesCompleted - previousSample.statesCompleted;
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "success",
      message: `State completion advanced by ${String(completedDelta)} (${String(nextSample.statesCompleted)}/${String(nextSample.statesTotal)})`,
    });
  }

  if (nextSample.writtenCount > previousSample.writtenCount) {
    const writtenDelta = nextSample.writtenCount - previousSample.writtenCount;
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "info",
      message: `Rows written +${writtenDelta.toLocaleString("en-US")} (total ${nextSample.writtenCount.toLocaleString("en-US")})`,
    });
  }

  if (previousSample.isRunning && !nextSample.isRunning && nextSample.phase === "completed") {
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "success",
      message: "Run completed",
    });
  }

  if (previousSample.isRunning && !nextSample.isRunning && nextSample.phase === "failed") {
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "critical",
      message: "Run failed",
    });
  }

  return events;
}

export function buildPipelineFetchErrorEvent(
  error: PipelineFetchFailure,
  capturedAt: string
): PipelineLiveEvent {
  return {
    capturedAt,
    requestId: error.requestId,
    tone: "critical",
    message: buildRequestFailureMessage(error),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: estimator intentionally composes multiple fallback strategies
export function estimatePipelineRate(history: readonly PipelineLiveSample[]): PipelineRateEstimate {
  const latestSample = history.at(-1);
  if (!latestSample) {
    return {
      recentRowsPerSecond: null,
      averageRowsPerSecond: null,
      rowsPerSecond: null,
      remainingRows: null,
      etaMs: null,
      rateBasis: null,
      stalledMs: null,
    };
  }

  if (latestSample.expectedCount === null) {
    return {
      recentRowsPerSecond: null,
      averageRowsPerSecond: null,
      rowsPerSecond: null,
      remainingRows: null,
      etaMs: null,
      rateBasis: null,
      stalledMs: null,
    };
  }

  const remainingRows = Math.max(0, latestSample.expectedCount - latestSample.writtenCount);
  if (remainingRows === 0) {
    return {
      recentRowsPerSecond: 0,
      averageRowsPerSecond: 0,
      rowsPerSecond: 0,
      remainingRows: 0,
      etaMs: 0,
      rateBasis: "recent",
      stalledMs: 0,
    };
  }

  const sameRunSamples = history.filter((sample) => sample.runId === latestSample.runId).slice(-10);
  const allSameRunSamples = history.filter((sample) => sample.runId === latestSample.runId);
  const firstSample = sameRunSamples[0];
  const lastSample = sameRunSamples.at(-1);
  const firstTimestamp = firstSample ? parseIsoToTimestamp(firstSample.capturedAt) : null;
  const lastTimestamp = lastSample ? parseIsoToTimestamp(lastSample.capturedAt) : null;

  let recentRowsPerSecond: number | null = null;
  if (
    firstSample &&
    lastSample &&
    firstTimestamp !== null &&
    lastTimestamp !== null &&
    lastTimestamp > firstTimestamp
  ) {
    const deltaRows = lastSample.writtenCount - firstSample.writtenCount;
    const deltaMs = lastTimestamp - firstTimestamp;
    if (deltaRows >= 0) {
      recentRowsPerSecond = deltaRows / (deltaMs / 1000);
    }
  }

  let averageRowsPerSecond: number | null = null;
  const runStartedAtMs = parseNullableIsoToTimestamp(latestSample.runStartedAt);
  if (
    runStartedAtMs !== null &&
    lastTimestamp !== null &&
    lastTimestamp > runStartedAtMs &&
    latestSample.writtenCount > 0
  ) {
    averageRowsPerSecond = latestSample.writtenCount / ((lastTimestamp - runStartedAtMs) / 1000);
  }

  if (averageRowsPerSecond === null) {
    const earliestSample = allSameRunSamples[0];
    const latestRunSample = allSameRunSamples.at(-1);
    if (earliestSample && latestRunSample) {
      const earliestMs = parseIsoToTimestamp(earliestSample.capturedAt);
      const latestMs = parseIsoToTimestamp(latestRunSample.capturedAt);
      if (
        earliestMs !== null &&
        latestMs !== null &&
        latestMs > earliestMs &&
        latestRunSample.writtenCount > earliestSample.writtenCount
      ) {
        averageRowsPerSecond =
          (latestRunSample.writtenCount - earliestSample.writtenCount) /
          ((latestMs - earliestMs) / 1000);
      }
    }
  }

  let stalledMs: number | null = null;
  if (latestSample.isRunning && lastTimestamp !== null) {
    let lastProgressMs: number | null = null;
    const trackBuildMovement = latestSample.phase === "building";
    for (let index = allSameRunSamples.length - 1; index > 0; index -= 1) {
      const current = allSameRunSamples[index];
      const previous = allSameRunSamples[index - 1];
      if (!(current && previous)) {
        continue;
      }

      if (current.writtenCount > previous.writtenCount) {
        lastProgressMs = parseIsoToTimestamp(current.capturedAt);
        break;
      }

      if (trackBuildMovement) {
        const hasBuildPercentMovement =
          typeof current.buildProgressPercent === "number" &&
          typeof previous.buildProgressPercent === "number" &&
          current.buildProgressPercent > previous.buildProgressPercent;
        const hasBuildLogGrowth =
          typeof current.buildLogBytes === "number" &&
          typeof previous.buildLogBytes === "number" &&
          current.buildLogBytes > previous.buildLogBytes;

        if (hasBuildPercentMovement || hasBuildLogGrowth) {
          lastProgressMs = parseIsoToTimestamp(current.capturedAt);
          break;
        }
      }
    }

    if (lastProgressMs === null) {
      const latestStateUpdatedAtMs = parseNullableIsoToTimestamp(latestSample.lastStateUpdatedAt);
      if (latestStateUpdatedAtMs !== null) {
        lastProgressMs = latestStateUpdatedAtMs;
      } else if (runStartedAtMs !== null && latestSample.writtenCount > 0) {
        lastProgressMs = runStartedAtMs;
      }
    }

    if (lastProgressMs !== null && lastTimestamp >= lastProgressMs) {
      stalledMs = lastTimestamp - lastProgressMs;
    }
  }

  let rowsPerSecond: number | null = null;
  let rateBasis: "average" | "recent" | null = null;

  if (typeof recentRowsPerSecond === "number" && recentRowsPerSecond > 0) {
    rowsPerSecond = recentRowsPerSecond;
    rateBasis = "recent";
  } else if (typeof averageRowsPerSecond === "number" && averageRowsPerSecond > 0) {
    rowsPerSecond = averageRowsPerSecond;
    rateBasis = "average";
  } else if (recentRowsPerSecond === 0) {
    rowsPerSecond = 0;
    rateBasis = "recent";
  }

  const etaMs =
    typeof rowsPerSecond === "number" && rowsPerSecond > 0
      ? Math.round((remainingRows / rowsPerSecond) * 1000)
      : null;

  return {
    recentRowsPerSecond,
    averageRowsPerSecond,
    rowsPerSecond,
    remainingRows,
    etaMs,
    rateBasis,
    stalledMs,
  };
}

function parseProgressPercent(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

const BUILD_PROGRESS_RESET_DELTA = 0.25;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: estimator intentionally composes multiple fallback strategies
export function estimateTileBuildRate(
  history: readonly PipelineLiveSample[]
): PipelineBuildEstimate {
  const latestSample = history.at(-1);
  if (!latestSample || latestSample.phase !== "building") {
    return {
      recentPercentPerSecond: null,
      averagePercentPerSecond: null,
      percentPerSecond: null,
      remainingPercent: null,
      etaMs: null,
      rateBasis: null,
      stalledMs: null,
    };
  }

  const latestPercent = parseProgressPercent(latestSample.buildProgressPercent);
  if (latestPercent === null) {
    return {
      recentPercentPerSecond: null,
      averagePercentPerSecond: null,
      percentPerSecond: null,
      remainingPercent: null,
      etaMs: null,
      rateBasis: null,
      stalledMs: null,
    };
  }

  const remainingPercent = Math.max(0, 100 - latestPercent);
  if (remainingPercent === 0) {
    return {
      recentPercentPerSecond: 0,
      averagePercentPerSecond: 0,
      percentPerSecond: 0,
      remainingPercent: 0,
      etaMs: 0,
      rateBasis: "recent",
      stalledMs: 0,
    };
  }

  const sameRunSamples = history.filter(
    (sample) => sample.runId === latestSample.runId && sample.phase === "building"
  );
  const percentSamples = sameRunSamples.filter(
    (sample) => parseProgressPercent(sample.buildProgressPercent) !== null
  );
  const latestSegmentStartIndex = (() => {
    if (percentSamples.length <= 1) {
      return 0;
    }

    let startIndex = 0;
    const firstSample = percentSamples[0];
    if (!firstSample) {
      return 0;
    }

    let previousPercent = parseProgressPercent(firstSample.buildProgressPercent);
    for (let index = 1; index < percentSamples.length; index += 1) {
      const currentSample = percentSamples[index];
      if (!currentSample) {
        continue;
      }

      const currentPercent = parseProgressPercent(currentSample.buildProgressPercent);
      if (
        previousPercent !== null &&
        currentPercent !== null &&
        currentPercent + BUILD_PROGRESS_RESET_DELTA < previousPercent
      ) {
        startIndex = index;
      }

      previousPercent = currentPercent;
    }

    return startIndex;
  })();
  const currentProgressSegment = percentSamples.slice(latestSegmentStartIndex);

  let recentPercentPerSecond: number | null = null;
  const recentPercentSamples = currentProgressSegment.slice(-20);
  const recentFirst = recentPercentSamples[0];
  const recentLast = recentPercentSamples.at(-1);
  if (recentFirst && recentLast) {
    const firstMs = parseIsoToTimestamp(recentFirst.capturedAt);
    const lastMs = parseIsoToTimestamp(recentLast.capturedAt);
    const firstPercent = parseProgressPercent(recentFirst.buildProgressPercent);
    const lastPercent = parseProgressPercent(recentLast.buildProgressPercent);
    if (
      firstMs !== null &&
      lastMs !== null &&
      lastMs > firstMs &&
      firstPercent !== null &&
      lastPercent !== null
    ) {
      const deltaPercent = lastPercent - firstPercent;
      if (deltaPercent >= 0) {
        recentPercentPerSecond = deltaPercent / ((lastMs - firstMs) / 1000);
      }
    }
  }

  let averagePercentPerSecond: number | null = null;
  const latestCapturedAtMs = parseIsoToTimestamp(latestSample.capturedAt);
  const earliestPercentSample = currentProgressSegment[0];
  if (earliestPercentSample && latestCapturedAtMs !== null) {
    const earliestMs = parseIsoToTimestamp(earliestPercentSample.capturedAt);
    const earliestPercent = parseProgressPercent(earliestPercentSample.buildProgressPercent);
    if (
      earliestMs !== null &&
      earliestMs < latestCapturedAtMs &&
      earliestPercent !== null &&
      latestPercent > earliestPercent
    ) {
      averagePercentPerSecond =
        (latestPercent - earliestPercent) / ((latestCapturedAtMs - earliestMs) / 1000);
    }
  }

  let stalledMs: number | null = null;
  if (latestSample.isRunning && latestCapturedAtMs !== null) {
    let lastProgressMs: number | null = null;
    for (let index = sameRunSamples.length - 1; index > 0; index -= 1) {
      const current = sameRunSamples[index];
      const previous = sameRunSamples[index - 1];
      if (!(current && previous)) {
        continue;
      }

      const currentPercent = parseProgressPercent(current.buildProgressPercent);
      const previousPercent = parseProgressPercent(previous.buildProgressPercent);
      const hasPercentMovement =
        currentPercent !== null && previousPercent !== null && currentPercent > previousPercent;
      const hasBuildLogGrowth =
        typeof current.buildLogBytes === "number" &&
        typeof previous.buildLogBytes === "number" &&
        current.buildLogBytes > previous.buildLogBytes;
      if (hasPercentMovement || hasBuildLogGrowth) {
        lastProgressMs = parseIsoToTimestamp(current.capturedAt);
        break;
      }
    }

    if (lastProgressMs === null && earliestPercentSample) {
      lastProgressMs = parseIsoToTimestamp(earliestPercentSample.capturedAt);
    }

    if (lastProgressMs !== null && latestCapturedAtMs >= lastProgressMs) {
      stalledMs = latestCapturedAtMs - lastProgressMs;
    }
  }

  let percentPerSecond: number | null = null;
  let rateBasis: "average" | "recent" | null = null;
  if (typeof recentPercentPerSecond === "number" && recentPercentPerSecond > 0) {
    percentPerSecond = recentPercentPerSecond;
    rateBasis = "recent";
  } else if (typeof averagePercentPerSecond === "number" && averagePercentPerSecond > 0) {
    percentPerSecond = averagePercentPerSecond;
    rateBasis = "average";
  } else if (recentPercentPerSecond === 0) {
    percentPerSecond = 0;
    rateBasis = "recent";
  }

  const etaMs =
    typeof percentPerSecond === "number" && percentPerSecond > 0
      ? Math.round((remainingPercent / percentPerSecond) * 1000)
      : null;

  return {
    recentPercentPerSecond,
    averagePercentPerSecond,
    percentPerSecond,
    remainingPercent,
    etaMs,
    rateBasis,
    stalledMs,
  };
}
