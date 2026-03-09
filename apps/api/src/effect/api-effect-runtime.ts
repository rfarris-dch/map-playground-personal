import { DevTools } from "@effect/experimental";
import {
  Cause,
  Effect,
  Exit,
  type Fiber,
  FiberId,
  Layer,
  ManagedRuntime,
  Supervisor,
} from "effect";
import { recordRuntimeEffectFailure } from "@/effect/effect-failure-trail.service";

const DEFAULT_EFFECT_DEVTOOLS_URL = "ws://localhost:34437";
const API_REQUEST_CONTEXT_KEY = "ApiRequestContext";

interface RunApiEffectOptions {
  readonly signal?: AbortSignal;
}

interface HonoRequestSnapshot {
  readonly method: string;
  readonly path: string;
}

interface HonoContextSnapshot {
  readonly req: HonoRequestSnapshot;
}

interface ApiRequestContextSnapshot {
  readonly honoContext: HonoContextSnapshot;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

function isHonoRequestSnapshot(value: unknown): value is HonoRequestSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const method = Reflect.get(value, "method");
  const path = Reflect.get(value, "path");
  return typeof method === "string" && typeof path === "string";
}

function isAbortSignalSnapshot(value: unknown): value is AbortSignal {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return typeof Reflect.get(value, "aborted") === "boolean";
}

function isHonoContextSnapshot(value: unknown): value is HonoContextSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return isHonoRequestSnapshot(Reflect.get(value, "req"));
}

function isApiRequestContextSnapshot(value: unknown): value is ApiRequestContextSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    isHonoContextSnapshot(Reflect.get(value, "honoContext")) &&
    typeof Reflect.get(value, "requestId") === "string" &&
    isAbortSignalSnapshot(Reflect.get(value, "signal"))
  );
}

function readApiRequestContextSnapshot(
  fiber: Fiber.RuntimeFiber<unknown, unknown>
): ApiRequestContextSnapshot | null {
  const candidate = fiber.currentContext.unsafeMap.get(API_REQUEST_CONTEXT_KEY);
  return isApiRequestContextSnapshot(candidate) ? candidate : null;
}

function buildFailureSummary(cause: Cause.Cause<unknown>): {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
} {
  const failure = Cause.failureOption(cause);
  if (failure._tag === "Some") {
    const value = failure.value;
    if (value instanceof Error) {
      return {
        code: "EFFECT_FIBER_FAILURE",
        details: {
          name: value.name,
        },
        message: value.message,
      };
    }

    if (typeof value === "string") {
      return {
        code: "EFFECT_FIBER_FAILURE",
        message: value,
      };
    }

    if (typeof value === "object" && value !== null) {
      const code = Reflect.get(value, "code");
      const details = Reflect.get(value, "details");
      const message = Reflect.get(value, "message");
      if (typeof code === "string" && typeof message === "string") {
        return {
          code,
          ...(typeof details === "undefined" ? {} : { details }),
          message,
        };
      }
    }
  }

  const defect = Cause.dieOption(cause);
  if (defect._tag === "Some") {
    const value = defect.value;
    if (value instanceof Error) {
      return {
        code: "EFFECT_FIBER_DEFECT",
        details: {
          name: value.name,
        },
        message: value.message,
      };
    }

    return {
      code: "EFFECT_FIBER_DEFECT",
      details: value,
      message: "fiber died with an unhandled defect",
    };
  }

  return {
    code: "UNHANDLED_EFFECT_FIBER_FAILURE",
    message: "effect fiber failed",
  };
}

class RuntimeFailureSupervisor extends Supervisor.AbstractSupervisor<void> {
  readonly value = Effect.void;

  override onEnd(
    exit: Exit.Exit<unknown, unknown>,
    fiber: Fiber.RuntimeFiber<unknown, unknown>
  ): void {
    if (!Exit.isFailure(exit) || Cause.isInterruptedOnly(exit.cause)) {
      return;
    }

    const requestContext = readApiRequestContextSnapshot(fiber);
    const fiberId = fiber.id();
    const failure = buildFailureSummary(exit.cause);

    recordRuntimeEffectFailure({
      cause: Cause.pretty(exit.cause, { renderErrorCause: true }),
      code: failure.code,
      ...(typeof failure.details === "undefined" ? {} : { details: failure.details }),
      fiberId: fiberId.id,
      fiberThreadName: FiberId.threadName(fiberId),
      message: failure.message,
      ...(requestContext === null
        ? {}
        : {
            method: requestContext.honoContext.req.method,
            path: requestContext.honoContext.req.path,
            requestId: requestContext.requestId,
          }),
      source: requestContext === null ? "api-runtime-supervisor" : "api-runtime-supervisor-request",
    });
  }
}

const runtimeFailureSupervisorLayer = Supervisor.addSupervisor(new RuntimeFailureSupervisor());

function isEffectDevToolsEnabled(): boolean {
  const rawValue = process.env.MAP_EFFECT_DEVTOOLS;
  if (typeof rawValue !== "string") {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function resolveEffectDevToolsUrl(): string {
  const rawValue = process.env.MAP_EFFECT_DEVTOOLS_URL;
  if (typeof rawValue !== "string") {
    return DEFAULT_EFFECT_DEVTOOLS_URL;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : DEFAULT_EFFECT_DEVTOOLS_URL;
}

function buildApiRuntimeLayer() {
  if (!isEffectDevToolsEnabled()) {
    return runtimeFailureSupervisorLayer;
  }

  return Layer.mergeAll(runtimeFailureSupervisorLayer, DevTools.layer(resolveEffectDevToolsUrl()));
}

const apiEffectRuntime = ManagedRuntime.make(buildApiRuntimeLayer());

export function describeEffectDevToolsConnection(): string | null {
  return isEffectDevToolsEnabled() ? resolveEffectDevToolsUrl() : null;
}

export function runApiEffect<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunApiEffectOptions = {}
): Promise<TValue> {
  return apiEffectRuntime.runPromise(program, options);
}

export function runApiEffectExit<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunApiEffectOptions = {}
) {
  return apiEffectRuntime.runPromiseExit(program, options);
}
