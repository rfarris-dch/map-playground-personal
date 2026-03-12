import type {
  PipelineFetchFailure,
  PipelineLiveEvent,
  PipelineLiveSample,
} from "../pipeline.types";

function formatProgressValue(value: number, _unit: PipelineLiveSample["writtenUnit"]): string {
  return value.toLocaleString("en-US");
}

function formatByteProgressValue(value: number): string {
  if (value < 1024) {
    return `${String(value)} B`;
  }

  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(1)} MiB`;
  }

  const gib = mib / 1024;
  return `${gib.toFixed(1)} GiB`;
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

  if (
    nextSample.counterMode === "flood-staging-rows" &&
    typeof nextSample.stageBytes === "number" &&
    typeof previousSample.stageBytes === "number" &&
    nextSample.stageBytes > previousSample.stageBytes
  ) {
    const stageDelta = nextSample.stageBytes - previousSample.stageBytes;
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "info",
      message: `Stage size +${formatByteProgressValue(stageDelta)} (total ${formatByteProgressValue(nextSample.stageBytes)})`,
    });
  }

  if (nextSample.writtenCount > previousSample.writtenCount) {
    const writtenDelta = nextSample.writtenCount - previousSample.writtenCount;
    events.push({
      capturedAt: nextSample.capturedAt,
      requestId: nextSample.requestId,
      tone: "info",
      message: `Rows written +${formatProgressValue(writtenDelta, "rows")} (total ${formatProgressValue(nextSample.writtenCount, "rows")})`,
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
