import type { PipelineLiveSample } from "@/features/pipeline/pipeline.types";
import type { PipelineBuildEstimate } from "@/features/pipeline/pipeline-tracking/pipeline-tracking.types";
import { parseIsoToTimestamp } from "@/features/pipeline/pipeline-tracking/pipeline-tracking-time.service";

const BUILD_PROGRESS_RESET_DELTA = 0.25;

function parseProgressPercent(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function emptyBuildEstimate(): PipelineBuildEstimate {
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

function completedBuildEstimate(): PipelineBuildEstimate {
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

function latestSegmentStartIndex(percentSamples: readonly PipelineLiveSample[]): number {
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
}

function computeRecentPercentRate(
  currentProgressSegment: readonly PipelineLiveSample[]
): number | null {
  const recentPercentSamples = currentProgressSegment.slice(-20);
  const recentFirst = recentPercentSamples[0];
  const recentLast = recentPercentSamples.at(-1);
  if (!(recentFirst && recentLast)) {
    return null;
  }

  const firstMs = parseIsoToTimestamp(recentFirst.capturedAt);
  const lastMs = parseIsoToTimestamp(recentLast.capturedAt);
  const firstPercent = parseProgressPercent(recentFirst.buildProgressPercent);
  const lastPercent = parseProgressPercent(recentLast.buildProgressPercent);
  if (
    firstMs === null ||
    lastMs === null ||
    lastMs <= firstMs ||
    firstPercent === null ||
    lastPercent === null
  ) {
    return null;
  }

  const deltaPercent = lastPercent - firstPercent;
  if (deltaPercent < 0) {
    return null;
  }

  return deltaPercent / ((lastMs - firstMs) / 1000);
}

function computeAveragePercentRate(
  latestPercent: number,
  latestCapturedAtMs: number | null,
  earliestPercentSample: PipelineLiveSample | undefined
): number | null {
  if (!earliestPercentSample || latestCapturedAtMs === null) {
    return null;
  }

  const earliestMs = parseIsoToTimestamp(earliestPercentSample.capturedAt);
  const earliestPercent = parseProgressPercent(earliestPercentSample.buildProgressPercent);
  if (
    earliestMs === null ||
    earliestMs >= latestCapturedAtMs ||
    earliestPercent === null ||
    latestPercent <= earliestPercent
  ) {
    return null;
  }

  return (latestPercent - earliestPercent) / ((latestCapturedAtMs - earliestMs) / 1000);
}

function inferLastBuildProgressTimestamp(
  sameRunSamples: readonly PipelineLiveSample[]
): number | null {
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
      return parseIsoToTimestamp(current.capturedAt);
    }
  }

  return null;
}

function computeBuildStalledMs(
  latestSample: PipelineLiveSample,
  latestCapturedAtMs: number | null,
  sameRunSamples: readonly PipelineLiveSample[],
  earliestPercentSample: PipelineLiveSample | undefined
): number | null {
  if (!latestSample.isRunning || latestCapturedAtMs === null) {
    return null;
  }

  let lastProgressMs = inferLastBuildProgressTimestamp(sameRunSamples);
  if (lastProgressMs === null && earliestPercentSample) {
    lastProgressMs = parseIsoToTimestamp(earliestPercentSample.capturedAt);
  }

  if (lastProgressMs === null || latestCapturedAtMs < lastProgressMs) {
    return null;
  }

  return latestCapturedAtMs - lastProgressMs;
}

function selectPercentRate(
  recentPercentPerSecond: number | null,
  averagePercentPerSecond: number | null
): {
  readonly percentPerSecond: number | null;
  readonly rateBasis: "average" | "recent" | null;
} {
  if (typeof recentPercentPerSecond === "number" && recentPercentPerSecond > 0) {
    return {
      percentPerSecond: recentPercentPerSecond,
      rateBasis: "recent",
    };
  }

  if (typeof averagePercentPerSecond === "number" && averagePercentPerSecond > 0) {
    return {
      percentPerSecond: averagePercentPerSecond,
      rateBasis: "average",
    };
  }

  if (recentPercentPerSecond === 0) {
    return {
      percentPerSecond: 0,
      rateBasis: "recent",
    };
  }

  return {
    percentPerSecond: null,
    rateBasis: null,
  };
}

export function estimateTileBuildRate(
  history: readonly PipelineLiveSample[]
): PipelineBuildEstimate {
  const latestSample = history.at(-1);
  if (!latestSample || latestSample.phase !== "building") {
    return emptyBuildEstimate();
  }

  const latestPercent = parseProgressPercent(latestSample.buildProgressPercent);
  if (latestPercent === null) {
    return emptyBuildEstimate();
  }

  const remainingPercent = Math.max(0, 100 - latestPercent);
  if (remainingPercent === 0) {
    return completedBuildEstimate();
  }

  const sameRunSamples = history.filter(
    (sample) => sample.runId === latestSample.runId && sample.phase === "building"
  );
  const percentSamples = sameRunSamples.filter(
    (sample) => parseProgressPercent(sample.buildProgressPercent) !== null
  );
  const currentProgressSegment = percentSamples.slice(latestSegmentStartIndex(percentSamples));

  const recentPercentPerSecond = computeRecentPercentRate(currentProgressSegment);
  const latestCapturedAtMs = parseIsoToTimestamp(latestSample.capturedAt);
  const earliestPercentSample = currentProgressSegment[0];
  const averagePercentPerSecond = computeAveragePercentRate(
    latestPercent,
    latestCapturedAtMs,
    earliestPercentSample
  );
  const stalledMs = computeBuildStalledMs(
    latestSample,
    latestCapturedAtMs,
    sameRunSamples,
    earliestPercentSample
  );
  const selectedRate = selectPercentRate(recentPercentPerSecond, averagePercentPerSecond);

  const etaMs =
    typeof selectedRate.percentPerSecond === "number" && selectedRate.percentPerSecond > 0
      ? Math.round((remainingPercent / selectedRate.percentPerSecond) * 1000)
      : null;

  return {
    recentPercentPerSecond,
    averagePercentPerSecond,
    percentPerSecond: selectedRate.percentPerSecond,
    remainingPercent,
    etaMs,
    rateBasis: selectedRate.rateBasis,
    stalledMs,
  };
}
