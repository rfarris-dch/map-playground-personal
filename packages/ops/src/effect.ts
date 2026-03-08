import { TaggedError } from "effect/Data";
import { fail, flatMap, gen, succeed, sync, tryPromise } from "effect/Effect";
import { createRequestId, normalizeRequestIdHeader } from "./index";

const DEFAULT_REQUEST_ID_HEADER_NAME = "x-request-id";

interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export interface FetchJsonEffectArgs<T> {
  readonly fetchImplementation?: typeof fetch;
  readonly init?: RequestInit;
  readonly requestIdHeaderName?: string;
  readonly requestIdPrefix?: string;
  readonly schema: SafeParseSchema<T>;
  readonly url: string;
}

export interface FetchJsonEffectSuccess<T> {
  readonly data: T;
  readonly rawBody: unknown;
  readonly requestId: string;
  readonly response: Response;
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
) {
  if (initSignal instanceof AbortSignal) {
    return initSignal;
  }

  return effectSignal;
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
    const requestIdHeaderName = args.requestIdHeaderName ?? DEFAULT_REQUEST_ID_HEADER_NAME;
    const generatedRequestId = createRequestId(args.requestIdPrefix ?? "req");
    const headers = new Headers(args.init?.headers);
    headers.set(requestIdHeaderName, generatedRequestId);

    const response = yield* tryPromise({
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

    const requestId =
      normalizeRequestIdHeader(response.headers.get(requestIdHeaderName) ?? undefined) ??
      generatedRequestId;

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
