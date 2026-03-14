import { DevTools } from "@effect/experimental";
import {
  Cause,
  Effect,
  Exit,
  type Fiber,
  FiberId,
  FiberRef,
  Layer,
  ManagedRuntime,
  Supervisor,
} from "effect";
import { recordRuntimeEffectFailure } from "@/effect/effect-failure-trail.service";

const DEFAULT_EFFECT_DEVTOOLS_URL = "ws://localhost:34437";

interface RunApiEffectOptions {
  readonly failureMetadata?: RuntimeFailureMetadata;
  readonly signal?: AbortSignal;
}

interface RuntimeFailureMetadata {
  readonly method?: string;
  readonly path?: string;
  readonly requestId?: string;
  readonly source: string;
}

export interface SupervisorRequestMetadata {
  readonly method: string;
  readonly path: string;
  readonly requestId: string;
}

/**
 * A FiberRef that carries request metadata into child fibers for the
 * runtime supervisor. This replaces the brittle `unsafeMap.get("ApiRequestContext")`
 * string-key lookup with an explicit, type-safe propagation mechanism.
 */
export const SupervisorRequestMetadataRef: FiberRef.FiberRef<SupervisorRequestMetadata | null> =
  FiberRef.unsafeMake<SupervisorRequestMetadata | null>(null);

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

function recordFailureExit(
  exit: Exit.Exit<unknown, unknown>,
  metadata?: RuntimeFailureMetadata
): void {
  if (!Exit.isFailure(exit) || Cause.isInterruptedOnly(exit.cause)) {
    return;
  }

  const failure = buildFailureSummary(exit.cause);
  recordRuntimeEffectFailure({
    cause: Cause.pretty(exit.cause, { renderErrorCause: true }),
    code: failure.code,
    ...(typeof failure.details === "undefined" ? {} : { details: failure.details }),
    message: failure.message,
    ...(typeof metadata?.method === "string" ? { method: metadata.method } : {}),
    ...(typeof metadata?.path === "string" ? { path: metadata.path } : {}),
    ...(typeof metadata?.requestId === "string" ? { requestId: metadata.requestId } : {}),
    source: metadata?.source ?? "api-runtime",
  });
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

    const requestMetadata = fiber.getFiberRef(SupervisorRequestMetadataRef);
    const fiberId = fiber.id();
    const failure = buildFailureSummary(exit.cause);

    recordRuntimeEffectFailure({
      cause: Cause.pretty(exit.cause, { renderErrorCause: true }),
      code: failure.code,
      ...(typeof failure.details === "undefined" ? {} : { details: failure.details }),
      fiberId: fiberId.id,
      fiberThreadName: FiberId.threadName(fiberId),
      message: failure.message,
      ...(requestMetadata === null
        ? {}
        : {
            method: requestMetadata.method,
            path: requestMetadata.path,
            requestId: requestMetadata.requestId,
          }),
      source:
        requestMetadata === null ? "api-runtime-supervisor" : "api-runtime-supervisor-request",
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
  return runApiEffectExit(program, options).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    throw Cause.squash(exit.cause);
  });
}

export function runApiEffectExit<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunApiEffectOptions = {}
) {
  return apiEffectRuntime
    .runPromiseExit(program, {
      signal: options.signal,
    })
    .then((exit) => {
      recordFailureExit(exit, options.failureMetadata);
      return exit;
    });
}
