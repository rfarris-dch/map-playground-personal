import {
  ApiHeaders,
  buildParcelsSyncStatusRoute,
  type ParcelSyncPhase,
  ParcelsSyncStatusResponseSchema,
} from "@map-migration/contracts";
import type { PipelineStatusFetchResult, PipelineStatusPayload } from "./pipeline.types";

function createRequestId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1_000_000);
  return `pipeline-ui-${String(timestamp)}-${String(random)}`;
}

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

function toTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
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

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  return Reflect.get(error, "name") === "AbortError";
}

async function readErrorDetails(response: Response): Promise<unknown> {
  try {
    const json = await response.clone().json();
    return json;
  } catch {
    try {
      const text = await response.text();
      const normalized = toTrimmedText(text);
      return normalized ?? undefined;
    } catch {
      return undefined;
    }
  }
}

export async function fetchPipelineStatus(
  signal?: AbortSignal
): Promise<PipelineStatusFetchResult> {
  const generatedRequestId = createRequestId();
  const headers = new Headers();
  headers.set(ApiHeaders.requestId, generatedRequestId);
  const requestInit: RequestInit = {
    method: "GET",
    headers,
  };
  if (signal) {
    requestInit.signal = signal;
  }

  let response: Response;
  try {
    response = await fetch(buildParcelsSyncStatusRoute(), requestInit);
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        error: {
          reason: "aborted",
          requestId: generatedRequestId,
          message: "Request aborted",
          details: error,
        },
      };
    }

    return {
      ok: false,
      error: {
        reason: "network",
        requestId: generatedRequestId,
        message: "Network request failed",
        details: error,
      },
    };
  }

  const requestId = response.headers.get(ApiHeaders.requestId) ?? generatedRequestId;
  if (!response.ok) {
    const details = await readErrorDetails(response);
    return {
      ok: false,
      error: {
        reason: "http",
        requestId,
        status: response.status,
        message: `HTTP ${String(response.status)} ${response.statusText}`,
        details,
      },
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return {
      ok: false,
      error: {
        reason: "schema",
        requestId,
        message: "Response JSON parsing failed",
        details: error,
      },
    };
  }

  const parsed = ParcelsSyncStatusResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        reason: "schema",
        requestId,
        message: "Response schema validation failed",
        details: parsed.error,
      },
    };
  }

  return {
    ok: true,
    payload: {
      requestId,
      response: applyRawStateCompletionFlags(parsed.data, body),
    },
  };
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
