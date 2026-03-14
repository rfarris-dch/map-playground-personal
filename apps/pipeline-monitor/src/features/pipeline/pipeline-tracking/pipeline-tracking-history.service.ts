import type { PipelineLiveEvent, PipelineLiveSample } from "../pipeline.types";

const LIVE_SAMPLE_LIMIT = 240;
const LIVE_EVENT_LIMIT = 300;

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

export function appendPipelineLiveSample(
  history: readonly PipelineLiveSample[],
  nextSample: PipelineLiveSample
): readonly PipelineLiveSample[] {
  return appendWithLimit(history, [nextSample], LIVE_SAMPLE_LIMIT);
}

function carryFloodStagingWrittenCount(
  previous: PipelineLiveSample | undefined,
  nextSample: PipelineLiveSample
): PipelineLiveSample {
  if (
    typeof previous === "undefined" ||
    previous.counterMode !== "flood-staging-rows" ||
    nextSample.counterMode !== "flood-staging-rows" ||
    previous.runId !== nextSample.runId
  ) {
    return nextSample;
  }

  const existingCarry = previous.writtenCount - previous.rawWrittenCount;
  const carryBase =
    nextSample.rawWrittenCount < previous.rawWrittenCount ? previous.writtenCount : existingCarry;

  if (carryBase <= 0) {
    return nextSample;
  }

  return {
    ...nextSample,
    writtenCount: carryBase + nextSample.rawWrittenCount,
  };
}

export function appendResumedPipelineLiveSample(
  history: readonly PipelineLiveSample[],
  nextSample: PipelineLiveSample
): readonly PipelineLiveSample[] {
  return appendWithLimit(
    history,
    [carryFloodStagingWrittenCount(history.at(-1), nextSample)],
    LIVE_SAMPLE_LIMIT
  );
}

export function appendPipelineLiveEvents(
  current: readonly PipelineLiveEvent[],
  incoming: readonly PipelineLiveEvent[]
): readonly PipelineLiveEvent[] {
  return appendWithLimit(current, incoming, LIVE_EVENT_LIMIT);
}
