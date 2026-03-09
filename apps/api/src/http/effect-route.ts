import { Cause, Effect, Context as EffectContext, Exit, Option } from "effect";
import type { Context as HonoContext } from "hono";
import { runApiEffectExit } from "@/effect/api-effect-runtime";
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
  readonly code: string;
  readonly details?: unknown;
  readonly httpStatus: number;
  readonly message: string;
}

export class ApiRequestContext extends EffectContext.Tag("ApiRequestContext")<
  ApiRequestContext,
  ApiRequestContextService
>() {}

export class ApiRequestLogger extends EffectContext.Tag("ApiRequestLogger")<
  ApiRequestLogger,
  ApiRequestLoggerService
>() {}

export class ApiRouteError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly httpStatus: number;

  constructor(args: ApiRouteErrorArgs) {
    super(args.message);
    this.name = "ApiRouteError";
    this.code = args.code;
    this.details = args.details;
    this.httpStatus = args.httpStatus;
  }
}

export function routeError(args: ApiRouteErrorArgs): ApiRouteError {
  return new ApiRouteError(args);
}

export function failRoute(args: ApiRouteErrorArgs): Effect.Effect<never, ApiRouteError> {
  return Effect.fail(routeError(args));
}

export function fromApiRequest(
  handler: (requestContext: ApiRequestContextService) => Promise<Response> | Response
): Effect.Effect<Response, ApiRouteError, ApiRequestContext> {
  return Effect.flatMap(ApiRequestContext, (requestContext) =>
    Effect.tryPromise({
      try: async () => handler(requestContext),
      catch: (error) =>
        error instanceof ApiRouteError
          ? error
          : routeError({
              httpStatus: 500,
              code: "UNHANDLED_EFFECT_ROUTE_ERROR",
              message: "internal server error",
              details: toDebugDetails(error),
            }),
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

function renderRouteFailure(
  c: HonoContext,
  requestId: string,
  cause: Cause.Cause<unknown>
): Response {
  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure) && failure.value instanceof ApiRouteError) {
    return jsonError(c, {
      requestId,
      httpStatus: failure.value.httpStatus,
      code: failure.value.code,
      message: failure.value.message,
      details: failure.value.details,
    });
  }

  return jsonError(c, {
    requestId,
    httpStatus: 500,
    code: "UNHANDLED_EFFECT_ERROR",
    message: "internal server error",
    details: buildUnexpectedEffectErrorDetails(cause),
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
    Effect.provideService(ApiRequestContext, requestContext),
    Effect.provideService(ApiRequestLogger, createApiRequestLogger(requestId))
  );

  const exit = await runApiEffectExit(providedProgram, {
    signal,
  });

  if (Exit.isSuccess(exit)) {
    return withRequestId(exit.value, requestId);
  }

  return renderRouteFailure(c, requestId, exit.cause);
}
