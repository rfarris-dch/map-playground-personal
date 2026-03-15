import { Cause, Data, Effect, Context as EffectContext, Exit, Option } from "effect";
import type { Context as HonoContext } from "hono";
import { runApiEffectExit, SupervisorRequestMetadataRef } from "@/effect/api-effect-runtime";
import { recordRouteEffectFailure } from "@/effect/effect-failure-trail.service";
import { runWithApiRequestContextStorage } from "@/http/api-request-context-storage.service";
import { jsonError, resolveRequestId, toDebugDetails, withRequestId } from "./api-response";

export interface ApiRequestContextService {
  readonly honoContext: HonoContext;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

export interface ApiRequestLoggerService {
  debug(...args: readonly unknown[]): void;
  error(...args: readonly unknown[]): void;
}

export interface ApiRouteErrorArgs {
  /** Normalized top-level error category (e.g. QUERY_ERROR, MAPPING_ERROR). */
  readonly category?: string | undefined;
  readonly code: string;
  readonly details?: unknown;
  readonly httpStatus: number;
  readonly message: string;
  /** Feature-specific detail within the category (e.g. "facilities_postgis"). */
  readonly subtype?: string | undefined;
}

export class ApiRequestContext extends EffectContext.Tag("ApiRequestContext")<
  ApiRequestContext,
  ApiRequestContextService
>() {}

export class ApiRequestLogger extends EffectContext.Tag("ApiRequestLogger")<
  ApiRequestLogger,
  ApiRequestLoggerService
>() {}

export class ApiRouteError extends Data.TaggedError("ApiRouteError")<{
  readonly category?: string | undefined;
  readonly code: string;
  readonly details?: unknown;
  readonly httpStatus: number;
  readonly message: string;
  readonly subtype?: string | undefined;
}> {}

export function routeError(args: ApiRouteErrorArgs): ApiRouteError {
  return new ApiRouteError(args);
}

export function failRoute(args: ApiRouteErrorArgs): Effect.Effect<never, ApiRouteError> {
  return Effect.fail(routeError(args));
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return false;
}

function isTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (
    error.name === "TypeError" &&
    typeof error.message === "string" &&
    error.message.includes("fetch failed")
  ) {
    return true;
  }

  if (typeof error.message === "string") {
    const msg = error.message;
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("ECONNRESET") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("EHOSTUNREACH") ||
      msg.includes("EAI_AGAIN") ||
      msg.includes("UND_ERR_CONNECT_TIMEOUT") ||
      msg.includes("UND_ERR_SOCKET")
    ) {
      return true;
    }
  }

  return false;
}

function classifyRawError(error: unknown, signal: AbortSignal): ApiRouteError {
  if (error instanceof ApiRouteError) {
    return error;
  }

  if (isAbortError(error) || signal.aborted) {
    return routeError({
      httpStatus: 499,
      code: "CLIENT_REQUEST_ABORTED",
      message: "client disconnected",
    });
  }

  if (isTransportError(error)) {
    return routeError({
      httpStatus: 502,
      code: "UPSTREAM_TRANSPORT_ERROR",
      message: "upstream service unavailable",
      details: toDebugDetails(error),
    });
  }

  return routeError({
    httpStatus: 500,
    code: "UNHANDLED_EFFECT_ROUTE_ERROR",
    message: "internal server error",
    details: toDebugDetails(error),
  });
}

export function fromApiRequest(
  handler: (requestContext: ApiRequestContextService) => Promise<Response> | Response
): Effect.Effect<Response, ApiRouteError, ApiRequestContext> {
  return Effect.flatMap(ApiRequestContext, (requestContext) =>
    Effect.tryPromise({
      try: async () =>
        runWithApiRequestContextStorage(
          {
            requestId: requestContext.requestId,
            signal: requestContext.signal,
          },
          () => handler(requestContext)
        ),
      catch: (error) => classifyRawError(error, requestContext.signal),
    })
  );
}

function createApiRequestLogger(requestId: string): ApiRequestLoggerService {
  return {
    debug: (...args) => {
      console.debug(`[api][${requestId}]`, ...args);
    },
    error: (...args) => {
      console.error(`[api][${requestId}]`, ...args);
    },
  };
}

function isClientAbortRouteError(error: ApiRouteError): boolean {
  return error.code === "CLIENT_REQUEST_ABORTED";
}

function handleApiRouteError(c: HonoContext, requestId: string, error: ApiRouteError): Response {
  if (isClientAbortRouteError(error)) {
    console.debug(`[api][${requestId}] client disconnected`, {
      method: c.req.method,
      path: c.req.path,
    });
    return jsonError(c, {
      requestId,
      httpStatus: error.httpStatus,
      code: error.code,
      message: error.message,
    });
  }

  const cause = `${error._tag}: ${error.message}`;
  recordRouteEffectFailure({
    cause,
    code: error.code,
    details: error.details,
    httpStatus: error.httpStatus,
    message: error.message,
    method: c.req.method,
    path: c.req.path,
    requestId,
  });

  if (error.httpStatus >= 500) {
    console.error(`[api][${requestId}] handled route error`, {
      cause,
      code: error.code,
      method: c.req.method,
      path: c.req.path,
    });
  }

  return jsonError(c, {
    requestId,
    httpStatus: error.httpStatus,
    category: error.category,
    code: error.code,
    message: error.message,
    subtype: error.subtype,
    details: error.details,
  });
}

function buildUnexpectedEffectErrorDetails(cause: Cause.Cause<unknown>): unknown {
  const defect = Cause.dieOption(cause);
  if (Option.isSome(defect)) {
    return toDebugDetails(defect.value);
  }

  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure)) {
    return toDebugDetails(failure.value);
  }

  return toDebugDetails(Cause.pretty(cause));
}

function extractCauseError(cause: Cause.Cause<unknown>): unknown | undefined {
  const defect = Cause.dieOption(cause);
  if (Option.isSome(defect)) {
    return defect.value;
  }

  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure)) {
    return failure.value;
  }

  return undefined;
}

function isCauseAbortOrDisconnect(cause: Cause.Cause<unknown>, signal: AbortSignal): boolean {
  if (Cause.isInterruptedOnly(cause)) {
    return true;
  }

  if (signal.aborted) {
    return true;
  }

  const error = extractCauseError(cause);
  return typeof error !== "undefined" && isAbortError(error);
}

function classifyCauseTransportError(
  cause: Cause.Cause<unknown>
): { httpStatus: number; code: string; message: string; details: unknown } | undefined {
  const error = extractCauseError(cause);
  if (typeof error === "undefined" || !isTransportError(error)) {
    return undefined;
  }

  return {
    httpStatus: 502,
    code: "UPSTREAM_TRANSPORT_ERROR",
    message: "upstream service unavailable",
    details: toDebugDetails(error),
  };
}

function renderRouteFailure(
  c: HonoContext,
  requestId: string,
  cause: Cause.Cause<unknown>,
  signal: AbortSignal
): Response {
  if (isCauseAbortOrDisconnect(cause, signal)) {
    console.debug(`[api][${requestId}] client disconnected (effect)`, {
      method: c.req.method,
      path: c.req.path,
    });
    return jsonError(c, {
      requestId,
      httpStatus: 499,
      code: "CLIENT_REQUEST_ABORTED",
      message: "client disconnected",
    });
  }

  const transportError = classifyCauseTransportError(cause);
  if (typeof transportError !== "undefined") {
    const causePretty = Cause.pretty(cause);
    recordRouteEffectFailure({
      cause: causePretty,
      code: transportError.code,
      details: transportError.details,
      httpStatus: transportError.httpStatus,
      message: transportError.message,
      method: c.req.method,
      path: c.req.path,
      requestId,
    });
    console.warn(`[api][${requestId}] upstream transport failure`, {
      cause: causePretty,
      method: c.req.method,
      path: c.req.path,
    });
    return jsonError(c, {
      requestId,
      httpStatus: transportError.httpStatus,
      code: transportError.code,
      message: transportError.message,
      details: transportError.details,
    });
  }

  const causePretty = Cause.pretty(cause);
  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure) && failure.value instanceof ApiRouteError) {
    if (isClientAbortRouteError(failure.value)) {
      console.debug(`[api][${requestId}] client disconnected (effect failure)`, {
        method: c.req.method,
        path: c.req.path,
      });
      return jsonError(c, {
        requestId,
        httpStatus: failure.value.httpStatus,
        code: failure.value.code,
        message: failure.value.message,
      });
    }

    recordRouteEffectFailure({
      cause: causePretty,
      code: failure.value.code,
      details: failure.value.details,
      httpStatus: failure.value.httpStatus,
      message: failure.value.message,
      method: c.req.method,
      path: c.req.path,
      requestId,
    });
    console.error(`[api][${requestId}] effect route failure`, {
      cause: causePretty,
      code: failure.value.code,
      method: c.req.method,
      path: c.req.path,
    });
    return jsonError(c, {
      requestId,
      httpStatus: failure.value.httpStatus,
      category: failure.value.category,
      code: failure.value.code,
      message: failure.value.message,
      subtype: failure.value.subtype,
      details: failure.value.details,
    });
  }

  const details = buildUnexpectedEffectErrorDetails(cause);
  recordRouteEffectFailure({
    cause: causePretty,
    code: "UNHANDLED_EFFECT_ERROR",
    details,
    httpStatus: 500,
    message: "internal server error",
    method: c.req.method,
    path: c.req.path,
    requestId,
  });
  console.error(`[api][${requestId}] unhandled effect route failure`, {
    cause: causePretty,
    method: c.req.method,
    path: c.req.path,
  });
  return jsonError(c, {
    requestId,
    httpStatus: 500,
    code: "UNHANDLED_EFFECT_ERROR",
    message: "internal server error",
    details,
  });
}

export async function runEffectRoute(
  c: HonoContext,
  program: Effect.Effect<Response, ApiRouteError, ApiRequestContext | ApiRequestLogger>
): Promise<Response> {
  const requestId = resolveRequestId(c, "api");
  const signal = c.req.raw.signal;
  const requestContext: ApiRequestContextService = {
    honoContext: c,
    requestId,
    signal,
  };

  const providedProgram = program.pipe(
    Effect.catchIf(
      (error): error is ApiRouteError => error instanceof ApiRouteError,
      (error) => Effect.sync(() => handleApiRouteError(c, requestId, error))
    ),
    Effect.provideService(ApiRequestContext, requestContext),
    Effect.provideService(ApiRequestLogger, createApiRequestLogger(requestId)),
    Effect.locally(SupervisorRequestMetadataRef, {
      method: c.req.method,
      path: c.req.path,
      requestId,
    })
  );

  const exit = await runApiEffectExit(providedProgram, {
    failureMetadata: {
      method: c.req.method,
      path: c.req.path,
      requestId,
      source: "api-effect-route-runtime",
    },
    signal,
  });

  if (Exit.isSuccess(exit)) {
    return withRequestId(exit.value, requestId);
  }

  return renderRouteFailure(c, requestId, exit.cause, signal);
}
