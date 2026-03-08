import {
  ApiHeaders,
  buildParcelsSyncStatusRoute,
  type ParcelSyncPhase,
  ParcelsSyncStatusResponseSchema,
} from "@map-migration/contracts";
import {
  type FetchJsonEffectSuccess,
  fetchJsonEffect,
  type RequestEffectError,
} from "@map-migration/ops/effect";
import { Effect, Either } from "effect";
import type {
  PipelineStatusFetchResult,
  PipelineStatusPayload,
} from "@/features/pipeline/pipeline.types";

function phaseLabel(phase: ParcelSyncPhase): string {
  switch (phase) {
    case "idle":
      return "Idle";
    case "extracting":
      return "Extracting";
    case "loading":
      return "Loading Canonical";
    case "building":
      return "Building PMTiles";
    case "publishing":
      return "Publishing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyRawStateCompletionFlags(
  parsed: PipelineStatusPayload["response"],
  rawBody: unknown
): PipelineStatusPayload["response"] {
  if (!isRecord(rawBody)) {
    return parsed;
  }

  const rawRun = Reflect.get(rawBody, "run");
  if (!isRecord(rawRun)) {
    return parsed;
  }

  const rawStates = Reflect.get(rawRun, "states");
  if (!Array.isArray(rawStates)) {
    return parsed;
  }

  const completionByState = new Map<string, boolean>();
  for (const rawState of rawStates) {
    if (!isRecord(rawState)) {
      continue;
    }

    const rawCode = Reflect.get(rawState, "state");
    if (typeof rawCode !== "string" || rawCode.trim().length === 0) {
      continue;
    }

    const rawIsCompleted = Reflect.get(rawState, "isCompleted");
    if (typeof rawIsCompleted !== "boolean") {
      continue;
    }

    completionByState.set(rawCode.trim(), rawIsCompleted);
  }

  if (completionByState.size === 0) {
    return parsed;
  }

  const nextStates = parsed.run.states.map((stateRow) => {
    const rawIsCompleted = completionByState.get(stateRow.state);
    if (typeof rawIsCompleted !== "boolean") {
      return stateRow;
    }

    return {
      ...stateRow,
      isCompleted: rawIsCompleted,
    };
  });

  return {
    ...parsed,
    run: {
      ...parsed.run,
      states: nextStates,
    },
  };
}

function createPipelineStatusFailure(
  error: RequestEffectError
): Extract<PipelineStatusFetchResult, { ok: false }> {
  if (error._tag === "RequestAbortedError") {
    return {
      ok: false,
      error: {
        reason: "aborted",
        requestId: error.requestId,
        message: "Request aborted",
        details: error.cause,
      },
    };
  }

  if (error._tag === "RequestNetworkError") {
    return {
      ok: false,
      error: {
        reason: "network",
        requestId: error.requestId,
        message: "Network request failed",
        details: error.cause,
      },
    };
  }

  if (error._tag === "RequestHttpError") {
    return {
      ok: false,
      error: {
        reason: "http",
        requestId: error.requestId,
        status: error.status,
        message: `HTTP ${String(error.status)} ${error.statusText}`,
        details: error.details,
      },
    };
  }

  return {
    ok: false,
    error: {
      reason: "schema",
      requestId: error.requestId,
      message:
        error._tag === "RequestJsonParseError"
          ? "Response JSON parsing failed"
          : "Response schema validation failed",
      details: error.cause,
    },
  };
}

export function createFetchPipelineStatusEffect(
  signal?: AbortSignal
): Effect.Effect<PipelineStatusFetchResult, never> {
  return Effect.gen(function* () {
    const requestEffect: Effect.Effect<
      FetchJsonEffectSuccess<PipelineStatusPayload["response"]>,
      RequestEffectError,
      never
    > = fetchJsonEffect({
      init: {
        method: "GET",
        ...(typeof signal === "undefined" ? {} : { signal }),
      },
      requestIdHeaderName: ApiHeaders.requestId,
      requestIdPrefix: "pipeline-ui",
      schema: ParcelsSyncStatusResponseSchema,
      url: buildParcelsSyncStatusRoute(),
    });

    const result: Either.Either<
      FetchJsonEffectSuccess<PipelineStatusPayload["response"]>,
      RequestEffectError
    > = yield* Effect.either(requestEffect);

    if (Either.isLeft(result)) {
      return createPipelineStatusFailure(result.left);
    }

    return {
      ok: true,
      payload: {
        requestId: result.right.requestId,
        response: applyRawStateCompletionFlags(result.right.data, result.right.rawBody),
      },
    };
  });
}

export function fetchPipelineStatus(signal?: AbortSignal): Promise<PipelineStatusFetchResult> {
  return Effect.runPromise(createFetchPipelineStatusEffect(signal));
}

export function formatPhaseLabel(phase: ParcelSyncPhase): string {
  return phaseLabel(phase);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  const raw = numerator / denominator;
  if (!Number.isFinite(raw)) {
    return 0;
  }

  const percentage = Math.round(raw * 100);
  if (percentage < 0) {
    return 0;
  }

  if (percentage > 100) {
    return 100;
  }

  return percentage;
}

export function formatDurationMs(value: number | null): string {
  if (typeof value !== "number" || value < 0) {
    return "n/a";
  }

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m ${String(seconds)}s`;
  }

  if (minutes > 0) {
    return `${String(minutes)}m ${String(seconds)}s`;
  }

  return `${String(seconds)}s`;
}

export function formatTimestamp(value: string | null): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "n/a";
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "n/a";
  }

  return parsed.toLocaleString();
}
