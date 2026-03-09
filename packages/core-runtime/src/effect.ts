import { TaggedError } from "effect/Data";
import {
  catchAll,
  type Effect,
  void as effectVoid,
  fail,
  flatMap,
  gen,
  map,
  runPromise,
  sleep,
  succeed,
  sync,
  timeoutFail,
  tryPromise,
  zipRight,
} from "effect/Effect";
import { createRequestId, normalizeRequestIdHeader } from "./index";

const DEFAULT_REQUEST_ID_HEADER_NAME = "x-request-id";

interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export interface FetchResponseEffectArgs {
  readonly fetchImplementation?: typeof fetch;
  readonly init?: RequestInit;
  readonly maxAttempts?: number;
  readonly requestIdHeaderName?: string;
  readonly requestIdPrefix?: string;
  readonly retryDelayMs?: (attempt: number) => number;
  readonly shouldRetryError?: (error: RequestAbortedError | RequestNetworkError) => boolean;
  readonly shouldRetryResponse?: (response: Response) => boolean;
  readonly timeoutMs?: number;
  readonly url: string;
}

export interface FetchJsonEffectArgs<T> extends FetchResponseEffectArgs {
  readonly schema: SafeParseSchema<T>;
}

export interface FetchResponseEffectSuccess {
  readonly requestId: string;
  readonly response: Response;
}

export interface FetchJsonEffectSuccess<T> extends FetchResponseEffectSuccess {
  readonly data: T;
  readonly rawBody: unknown;
}

export type RequestEffectError =
  | RequestAbortedError
  | RequestHttpError
  | RequestJsonParseError
  | RequestNetworkError
  | RequestSchemaError;

export class RequestAbortedError extends TaggedError("RequestAbortedError")<{
  readonly cause: unknown;
  readonly requestId: string;
}> {}

export class RequestNetworkError extends TaggedError("RequestNetworkError")<{
  readonly cause: unknown;
  readonly requestId: string;
}> {}

export class RequestHttpError extends TaggedError("RequestHttpError")<{
  readonly details: unknown;
  readonly requestId: string;
  readonly status: number;
  readonly statusText: string;
}> {}

export class RequestJsonParseError extends TaggedError("RequestJsonParseError")<{
  readonly cause: unknown;
  readonly requestId: string;
}> {}

export class RequestSchemaError extends TaggedError("RequestSchemaError")<{
  readonly cause: unknown;
  readonly payload: unknown;
  readonly requestId: string;
}> {}

export function isRequestEffectError(error: unknown): error is RequestEffectError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const tag = Reflect.get(error, "_tag");
  return (
    tag === "RequestAbortedError" ||
    tag === "RequestHttpError" ||
    tag === "RequestJsonParseError" ||
    tag === "RequestNetworkError" ||
    tag === "RequestSchemaError"
  );
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  return Reflect.get(error, "name") === "AbortError";
}

export function createAbortError(message: string): Error | DOMException {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }

  const error = new Error(message);
  Object.defineProperty(error, "name", {
    configurable: true,
    enumerable: false,
    value: "AbortError",
    writable: true,
  });
  return error;
}

async function readErrorDetails(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    try {
      const text = await response.text();
      const normalized = text.trim();
      return normalized.length > 0 ? normalized : undefined;
    } catch {
      return undefined;
    }
  }
}

function resolveRequestSignal(
  initSignal: AbortSignal | null | undefined,
  effectSignal: AbortSignal
): AbortSignal {
  if (initSignal instanceof AbortSignal) {
    return AbortSignal.any([initSignal, effectSignal]);
  }

  return effectSignal;
}

function normalizeAttemptCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function buildFetchHeaders(
  init: RequestInit | undefined,
  requestIdHeaderName: string,
  requestId: string
): Headers {
  const headers = new Headers(init?.headers);
  headers.set(requestIdHeaderName, requestId);
  return headers;
}

function fetchAttemptEffect(
  args: FetchResponseEffectArgs,
  generatedRequestId: string,
  requestIdHeaderName: string,
  headers: Headers
): Effect<FetchResponseEffectSuccess, RequestAbortedError | RequestNetworkError, never> {
  const fetchEffect = tryPromise({
    try: (signal) =>
      (args.fetchImplementation ?? fetch)(args.url, {
        ...args.init,
        headers,
        signal: resolveRequestSignal(args.init?.signal, signal),
      }),
    catch: (cause) =>
      isAbortError(cause)
        ? new RequestAbortedError({
            cause,
            requestId: generatedRequestId,
          })
        : new RequestNetworkError({
            cause,
            requestId: generatedRequestId,
          }),
  });

  const responseEffect =
    typeof args.timeoutMs === "number" && args.timeoutMs > 0
      ? fetchEffect.pipe(
          timeoutFail({
            duration: args.timeoutMs,
            onTimeout: () =>
              new RequestAbortedError({
                cause: createAbortError("request timed out"),
                requestId: generatedRequestId,
              }),
          })
        )
      : fetchEffect;

  return responseEffect.pipe(
    map((response) => ({
      requestId:
        normalizeRequestIdHeader(response.headers.get(requestIdHeaderName) ?? undefined) ??
        generatedRequestId,
      response,
    }))
  );
}

function delayRetryEffect(ms: number): Effect<void> {
  if (ms <= 0) {
    return effectVoid;
  }

  return sleep(ms);
}

function retryFetchResponseEffect(
  args: FetchResponseEffectArgs,
  generatedRequestId: string,
  requestIdHeaderName: string,
  headers: Headers,
  attempt: number
): Effect<FetchResponseEffectSuccess, RequestAbortedError | RequestNetworkError, never> {
  const maxAttempts = normalizeAttemptCount(args.maxAttempts);
  const retryDelayMs = args.retryDelayMs ?? (() => 0);

  return fetchAttemptEffect(args, generatedRequestId, requestIdHeaderName, headers).pipe(
    catchAll((error) => {
      if (attempt + 1 >= maxAttempts || args.shouldRetryError?.(error) !== true) {
        return fail(error);
      }

      return delayRetryEffect(retryDelayMs(attempt)).pipe(
        zipRight(
          retryFetchResponseEffect(
            args,
            generatedRequestId,
            requestIdHeaderName,
            headers,
            attempt + 1
          )
        )
      );
    }),
    flatMap((result) => {
      if (attempt + 1 >= maxAttempts || args.shouldRetryResponse?.(result.response) !== true) {
        return succeed(result);
      }

      return sync(() => {
        result.response.body?.cancel().catch(() => undefined);
      }).pipe(
        zipRight(delayRetryEffect(retryDelayMs(attempt))),
        zipRight(
          retryFetchResponseEffect(
            args,
            generatedRequestId,
            requestIdHeaderName,
            headers,
            attempt + 1
          )
        )
      );
    })
  );
}

export function fetchResponseEffect(args: FetchResponseEffectArgs) {
  const requestIdHeaderName = args.requestIdHeaderName ?? DEFAULT_REQUEST_ID_HEADER_NAME;
  const generatedRequestId = createRequestId(args.requestIdPrefix ?? "req");
  const headers = buildFetchHeaders(args.init, requestIdHeaderName, generatedRequestId);
  return retryFetchResponseEffect(args, generatedRequestId, requestIdHeaderName, headers, 0);
}

export function decodeWithSchemaEffect<T>(
  schema: SafeParseSchema<T>,
  input: unknown,
  requestId: string
) {
  return sync(() => schema.safeParse(input)).pipe(
    flatMap((parsed) =>
      parsed.success
        ? succeed(parsed.data)
        : fail(
            new RequestSchemaError({
              cause: parsed.error,
              payload: input,
              requestId,
            })
          )
    )
  );
}

export function fetchJsonEffect<T>(args: FetchJsonEffectArgs<T>) {
  return gen(function* () {
    const { requestId, response } = yield* fetchResponseEffect(args);

    if (!response.ok) {
      const details = yield* tryPromise({
        try: () => readErrorDetails(response),
        catch: (cause) =>
          new RequestJsonParseError({
            cause,
            requestId,
          }),
      });

      yield* fail(
        new RequestHttpError({
          details,
          requestId,
          status: response.status,
          statusText: response.statusText,
        })
      );
    }

    const rawBody = yield* tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new RequestJsonParseError({
          cause,
          requestId,
        }),
    });
    const data = yield* decodeWithSchemaEffect(args.schema, rawBody, requestId);

    return {
      data,
      rawBody,
      requestId,
      response,
    } satisfies FetchJsonEffectSuccess<T>;
  });
}

export function runEffectPromise<TValue, TError>(
  program: Effect<TValue, TError, never>,
  signal?: AbortSignal
): Promise<TValue> {
  return runPromise(program, signal == null ? undefined : { signal });
}

export function waitForAbortableValue<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (typeof signal === "undefined") {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError("The operation was aborted."));
  }

  return runEffectPromise(
    tryPromise(() => promise),
    signal
  ).catch((error) => {
    if (signal.aborted) {
      throw createAbortError("The operation was aborted.");
    }

    throw error;
  });
}
