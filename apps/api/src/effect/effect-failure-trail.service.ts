import { toDebugDetails } from "@/http/api-response";

const MAX_EFFECT_FAILURE_EVENTS = 50;

export interface EffectFailureEvent {
  readonly cause: string;
  readonly code: string;
  readonly details?: unknown;
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

function appendEffectFailureEvent(event: EffectFailureEvent): void {
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
  readonly message: string;
  readonly source: string;
}): void {
  appendEffectFailureEvent({
    cause: args.cause,
    code: args.code,
    ...(typeof args.details === "undefined" ? {} : { details: toDebugDetails(args.details) }),
    message: args.message,
    occurredAt: new Date().toISOString(),
    scope: "runtime",
    source: args.source,
  });
}

export function getRecentEffectFailures(): readonly EffectFailureEvent[] {
  return effectFailureEvents.map((event) => ({ ...event }));
}
