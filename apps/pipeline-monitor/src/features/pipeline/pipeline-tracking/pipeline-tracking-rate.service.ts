import type { PipelineLiveSample } from "@/features/pipeline/pipeline.types";
import type { PipelineRateEstimate } from "@/features/pipeline/pipeline-tracking/pipeline-tracking.types";
import { parseIsoToTimestamp, parseNullableIsoToTimestamp } from "./pipeline-tracking-time.service";

function emptyRateEstimate(): PipelineRateEstimate {
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

function completedRateEstimate(): PipelineRateEstimate {
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

function computeRecentRowsPerSecond(samples: readonly PipelineLiveSample[]): number | null {
  const recentSamples = samples.slice(-10);
  const firstSample = recentSamples[0];
  const lastSample = recentSamples.at(-1);
  if (!(firstSample && lastSample)) {
    return null;
  }

  const firstTimestamp = parseIsoToTimestamp(firstSample.capturedAt);
  const lastTimestamp = parseIsoToTimestamp(lastSample.capturedAt);
  if (firstTimestamp === null || lastTimestamp === null || lastTimestamp <= firstTimestamp) {
    return null;
  }

  const deltaRows = lastSample.writtenCount - firstSample.writtenCount;
  if (deltaRows < 0) {
    return null;
  }

  return deltaRows / ((lastTimestamp - firstTimestamp) / 1000);
}

function computeAverageRowsPerSecond(
  latestSample: PipelineLiveSample,
  allSameRunSamples: readonly PipelineLiveSample[],
  latestTimestamp: number | null,
  runStartedAtMs: number | null
): number | null {
  const earliestSample = allSameRunSamples[0];
  const latestRunSample = allSameRunSamples.at(-1);
  if (!(earliestSample && latestRunSample)) {
    if (
      runStartedAtMs !== null &&
      latestTimestamp !== null &&
      latestTimestamp > runStartedAtMs &&
      latestSample.writtenCount > 0
    ) {
      return latestSample.writtenCount / ((latestTimestamp - runStartedAtMs) / 1000);
    }

    return null;
  }

  const earliestMs = parseIsoToTimestamp(earliestSample.capturedAt);
  const latestMs = parseIsoToTimestamp(latestRunSample.capturedAt);
  if (
    earliestMs === null ||
    latestMs === null ||
    latestMs <= earliestMs ||
    latestRunSample.writtenCount <= earliestSample.writtenCount
  ) {
    if (
      runStartedAtMs !== null &&
      latestTimestamp !== null &&
      latestTimestamp > runStartedAtMs &&
      latestSample.writtenCount > 0
    ) {
      return latestSample.writtenCount / ((latestTimestamp - runStartedAtMs) / 1000);
    }

    return null;
  }

  return (
    (latestRunSample.writtenCount - earliestSample.writtenCount) / ((latestMs - earliestMs) / 1000)
  );
}

function sliceFloodLoadingSegment(
  allSameRunSamples: readonly PipelineLiveSample[]
): readonly PipelineLiveSample[] {
  const latestSample = allSameRunSamples.at(-1);
  if (
    !latestSample ||
    latestSample.counterMode !== "flood-staging-rows" ||
    latestSample.phase !== "loading"
  ) {
    return allSameRunSamples;
  }

  let segmentStartIndex = 0;
  for (let index = 1; index < allSameRunSamples.length; index += 1) {
    const previousSample = allSameRunSamples[index - 1];
    const currentSample = allSameRunSamples[index];
    if (!(previousSample && currentSample)) {
      continue;
    }

    if (
      currentSample.counterMode !== "flood-staging-rows" ||
      currentSample.phase !== "loading" ||
      currentSample.writtenCount < previousSample.writtenCount
    ) {
      segmentStartIndex = index;
    }
  }

  return allSameRunSamples.slice(segmentStartIndex);
}

function inferLastProgressTimestamp(
  allSameRunSamples: readonly PipelineLiveSample[],
  trackBuildMovement: boolean
): number | null {
  for (let index = allSameRunSamples.length - 1; index > 0; index -= 1) {
    const current = allSameRunSamples[index];
    const previous = allSameRunSamples[index - 1];
    if (!(current && previous)) {
      continue;
    }

    if (current.writtenCount > previous.writtenCount) {
      return parseIsoToTimestamp(current.capturedAt);
    }

    if (!trackBuildMovement) {
      continue;
    }

    const hasBuildPercentMovement =
      typeof current.buildProgressPercent === "number" &&
      typeof previous.buildProgressPercent === "number" &&
      current.buildProgressPercent > previous.buildProgressPercent;
    const hasBuildLogGrowth =
      typeof current.buildLogBytes === "number" &&
      typeof previous.buildLogBytes === "number" &&
      current.buildLogBytes > previous.buildLogBytes;
    if (hasBuildPercentMovement || hasBuildLogGrowth) {
      return parseIsoToTimestamp(current.capturedAt);
    }
  }

  return null;
}

function computeStalledMs(
  latestSample: PipelineLiveSample,
  allSameRunSamples: readonly PipelineLiveSample[],
  latestTimestamp: number | null,
  runStartedAtMs: number | null
): number | null {
  if (!latestSample.isRunning || latestTimestamp === null) {
    return null;
  }

  let lastProgressMs = inferLastProgressTimestamp(
    allSameRunSamples,
    latestSample.phase === "building"
  );
  if (lastProgressMs === null) {
    const latestStateUpdatedAtMs = parseNullableIsoToTimestamp(latestSample.lastStateUpdatedAt);
    if (latestStateUpdatedAtMs !== null) {
      lastProgressMs = latestStateUpdatedAtMs;
    } else if (runStartedAtMs !== null && latestSample.writtenCount > 0) {
      lastProgressMs = runStartedAtMs;
    }
  }

  if (lastProgressMs === null || latestTimestamp < lastProgressMs) {
    return null;
  }

  return latestTimestamp - lastProgressMs;
}

function selectRowsPerSecond(
  recentRowsPerSecond: number | null,
  averageRowsPerSecond: number | null
): {
  readonly rowsPerSecond: number | null;
  readonly rateBasis: "average" | "recent" | null;
} {
  if (typeof recentRowsPerSecond === "number" && recentRowsPerSecond > 0) {
    return {
      rowsPerSecond: recentRowsPerSecond,
      rateBasis: "recent",
    };
  }

  if (typeof averageRowsPerSecond === "number" && averageRowsPerSecond > 0) {
    return {
      rowsPerSecond: averageRowsPerSecond,
      rateBasis: "average",
    };
  }

  if (recentRowsPerSecond === 0) {
    return {
      rowsPerSecond: 0,
      rateBasis: "recent",
    };
  }

  return {
    rowsPerSecond: null,
    rateBasis: null,
  };
}

export function estimatePipelineRate(history: readonly PipelineLiveSample[]): PipelineRateEstimate {
  const latestSample = history.at(-1);
  if (!latestSample) {
    return emptyRateEstimate();
  }

  const remainingRows =
    latestSample.expectedCount === null
      ? null
      : Math.max(0, latestSample.expectedCount - latestSample.writtenCount);
  if (remainingRows === 0) {
    return completedRateEstimate();
  }

  const allSameRunSamples = history.filter((sample) => sample.runId === latestSample.runId);
  const rateWindowSamples = sliceFloodLoadingSegment(allSameRunSamples);
  const recentRowsPerSecond = computeRecentRowsPerSecond(rateWindowSamples);

  const latestTimestamp = parseIsoToTimestamp(latestSample.capturedAt);
  const runStartedAtMs = parseNullableIsoToTimestamp(latestSample.runStartedAt);
  const averageRowsPerSecond = computeAverageRowsPerSecond(
    latestSample,
    rateWindowSamples,
    latestTimestamp,
    runStartedAtMs
  );
  const stalledMs = computeStalledMs(
    latestSample,
    rateWindowSamples,
    latestTimestamp,
    runStartedAtMs
  );
  const selectedRate = selectRowsPerSecond(recentRowsPerSecond, averageRowsPerSecond);

  const etaMs =
    typeof selectedRate.rowsPerSecond === "number" &&
    selectedRate.rowsPerSecond > 0 &&
    typeof remainingRows === "number"
      ? Math.round((remainingRows / selectedRate.rowsPerSecond) * 1000)
      : null;

  return {
    recentRowsPerSecond,
    averageRowsPerSecond,
    rowsPerSecond: selectedRate.rowsPerSecond,
    remainingRows,
    etaMs,
    rateBasis: selectedRate.rateBasis,
    stalledMs,
  };
}
