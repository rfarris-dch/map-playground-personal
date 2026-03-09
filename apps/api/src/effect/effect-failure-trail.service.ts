import { toDebugDetails } from "@/http/api-response";

const MAX_EFFECT_FAILURE_EVENTS = 50;

export interface EffectFailureEvent {
  readonly cause: string;
  readonly code: string;
  readonly details?: unknown;
  readonly fiberId?: number;
  readonly fiberThreadName?: string;
  readonly httpStatus?: number;
  readonly message: string;
  readonly method?: string;
  readonly occurredAt: string;
  readonly path?: string;
  readonly requestId?: string;
  readonly scope: "route" | "runtime";
  readonly source: string;
}

const effectFailureEvents: EffectFailureEvent[] = [];

function isDuplicateFailureEvent(
  previous: EffectFailureEvent | undefined,
  next: EffectFailureEvent
): boolean {
  if (typeof previous === "undefined") {
    return false;
  }

  return (
    previous.cause === next.cause &&
    previous.code === next.code &&
    previous.message === next.message &&
    previous.method === next.method &&
    previous.path === next.path &&
    previous.requestId === next.requestId
  );
}

function appendEffectFailureEvent(event: EffectFailureEvent): void {
  if (isDuplicateFailureEvent(effectFailureEvents[0], event)) {
    return;
  }

  effectFailureEvents.unshift(event);
  if (effectFailureEvents.length > MAX_EFFECT_FAILURE_EVENTS) {
    effectFailureEvents.length = MAX_EFFECT_FAILURE_EVENTS;
  }
}

export function recordRouteEffectFailure(args: {
  readonly cause: string;
  readonly code: string;
  readonly details?: unknown;
  readonly httpStatus: number;
  readonly message: string;
  readonly method: string;
  readonly path: string;
  readonly requestId: string;
}): void {
  appendEffectFailureEvent({
    cause: args.cause,
    code: args.code,
    ...(typeof args.details === "undefined" ? {} : { details: toDebugDetails(args.details) }),
    httpStatus: args.httpStatus,
    message: args.message,
    method: args.method,
    occurredAt: new Date().toISOString(),
    path: args.path,
    requestId: args.requestId,
    scope: "route",
    source: "api-route",
  });
}

export function recordRuntimeEffectFailure(args: {
  readonly cause: string;
  readonly code: string;
  readonly details?: unknown;
  readonly fiberId?: number;
  readonly fiberThreadName?: string;
  readonly message: string;
  readonly method?: string;
  readonly path?: string;
  readonly requestId?: string;
  readonly source: string;
}): void {
  appendEffectFailureEvent({
    cause: args.cause,
    code: args.code,
    ...(typeof args.details === "undefined" ? {} : { details: toDebugDetails(args.details) }),
    ...(typeof args.fiberId === "number" ? { fiberId: args.fiberId } : {}),
    ...(typeof args.fiberThreadName === "string" ? { fiberThreadName: args.fiberThreadName } : {}),
    message: args.message,
    ...(typeof args.method === "string" ? { method: args.method } : {}),
    occurredAt: new Date().toISOString(),
    ...(typeof args.path === "string" ? { path: args.path } : {}),
    ...(typeof args.requestId === "string" ? { requestId: args.requestId } : {}),
    scope: "runtime",
    source: args.source,
  });
}

export function getRecentEffectFailures(): readonly EffectFailureEvent[] {
  return effectFailureEvents.map((event) => ({ ...event }));
}
