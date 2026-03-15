import { ApiErrorResponseSchema } from "@map-migration/http-contracts/api-error";
import { ApiHeaders } from "@map-migration/http-contracts/api-routes";
import { failureOption } from "effect/Cause";
import { TaggedError } from "effect/Data";
import { catchAll, die, type Effect, fail, map, runPromiseExit } from "effect/Effect";
import { isSuccess } from "effect/Exit";
import { isSome } from "effect/Option";
import type { RequestAbortedError, RequestNetworkError, SafeParseSchema } from "./effect";
import { type FetchJsonEffectSuccess, fetchJsonEffect } from "./effect";

export interface ParsedApiError {
  readonly category?: string | undefined;
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
  readonly requestId: string;
  readonly subtype?: string | undefined;
}

export interface ApiEffectSuccess<TValue> {
  readonly data: TValue;
  readonly rawBody: unknown;
  readonly requestId: string;
  readonly response: Response;
}

export type ApiResult<T> =
  | { ok: true; requestId: string; data: T }
  | {
      code?: string;
      message?: string;
      ok: false;
      requestId: string;
      reason: "aborted" | "http" | "schema" | "network";
      status?: number;
      details?: unknown;
    };

export interface ApiFailureShape {
  readonly category?: string | undefined;
  readonly code?: string;
  readonly details?: unknown;
  readonly message?: string;
  readonly requestId: string;
  readonly status?: number;
  readonly subtype?: string | undefined;
}

export class ApiAbortedError extends TaggedError("ApiAbortedError")<{
  readonly details?: unknown;
  readonly requestId: string;
}> {}

export class ApiNetworkError extends TaggedError("ApiNetworkError")<{
  readonly cause: unknown;
  readonly requestId: string;
}> {}

export class ApiHttpError extends TaggedError("ApiHttpError")<ApiFailureShape> {}

export class ApiSchemaError extends TaggedError("ApiSchemaError")<{
  readonly details: unknown;
  readonly kind: "json-parse" | "schema";
  readonly requestId: string;
}> {}

export type ApiEffectError = ApiAbortedError | ApiHttpError | ApiNetworkError | ApiSchemaError;

// ---------------------------------------------------------------------------
// Retry profiles
// ---------------------------------------------------------------------------

/** Status codes that are safe to retry on idempotent GET requests. */
const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * Per-call retry configuration for API requests.
 *
 * Every field is optional -- unset fields fall back to `DEFAULT_GET_RETRY_PROFILE`.
 */
export interface ApiRetryProfile {
  /** Base delay in ms used by the back-off calculation. */
  readonly baseDelayMs?: number;
  /** Maximum total attempts (first try + retries).  Minimum 1. */
  readonly maxAttempts?: number;
  /** Upper bound on computed delay (before jitter).  Prevents run-away waits. */
  readonly maxDelayMs?: number;
  /**
   * Set of HTTP status codes that should trigger a retry.
   * Only evaluated when the response does NOT carry a structured API error
   * (i.e. no `x-request-id` body).
   */
  readonly retryableStatusCodes?: ReadonlySet<number>;
  /** Whether to retry on network errors (fetch itself throws). */
  readonly retryNetworkErrors?: boolean;
  /** Whether to retry when the request times out / is aborted internally. */
  readonly retryTimeouts?: boolean;
}

/** Sensible default for idempotent GET traffic. */
const DEFAULT_GET_RETRY_PROFILE: Readonly<Required<ApiRetryProfile>> = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 4000,
  retryableStatusCodes: RETRYABLE_STATUS_CODES,
  retryNetworkErrors: true,
  retryTimeouts: true,
};

/** Resolve caller overrides on top of the default profile. */
function resolveRetryProfile(
  override: ApiRetryProfile | undefined
): Readonly<Required<ApiRetryProfile>> {
  if (override === undefined) {
    return DEFAULT_GET_RETRY_PROFILE;
  }

  return {
    maxAttempts: override.maxAttempts ?? DEFAULT_GET_RETRY_PROFILE.maxAttempts,
    baseDelayMs: override.baseDelayMs ?? DEFAULT_GET_RETRY_PROFILE.baseDelayMs,
    maxDelayMs: override.maxDelayMs ?? DEFAULT_GET_RETRY_PROFILE.maxDelayMs,
    retryableStatusCodes:
      override.retryableStatusCodes ?? DEFAULT_GET_RETRY_PROFILE.retryableStatusCodes,
    retryNetworkErrors: override.retryNetworkErrors ?? DEFAULT_GET_RETRY_PROFILE.retryNetworkErrors,
    retryTimeouts: override.retryTimeouts ?? DEFAULT_GET_RETRY_PROFILE.retryTimeouts,
  };
}

/**
 * Exponential back-off with jitter.
 *
 * delay = min(base * 2^attempt, maxDelay) + jitter
 *
 * If the response carried a `Retry-After` header (seconds), that value is
 * used as the floor instead.
 */
function retryDelayMs(
  profile: Readonly<Required<ApiRetryProfile>>,
  attempt: number,
  retryAfterSeconds: number | undefined
): number {
  const exponential = Math.min(profile.baseDelayMs * 2 ** attempt, profile.maxDelayMs);
  const jitter = Math.floor(Math.random() * profile.baseDelayMs);
  const computed = exponential + jitter;

  if (typeof retryAfterSeconds === "number" && retryAfterSeconds > 0) {
    const serverMs = retryAfterSeconds * 1000;
    return Math.max(computed, serverMs);
  }

  return computed;
}

/** Parse the numeric form of Retry-After (seconds). */
function parseRetryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (typeof header !== "string" || header.trim().length === 0) {
    return undefined;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  return undefined;
}

function shouldRetryError(
  profile: Readonly<Required<ApiRetryProfile>>,
  error: RequestAbortedError | RequestNetworkError
): boolean {
  if (error._tag === "RequestNetworkError") {
    return profile.retryNetworkErrors;
  }

  // RequestAbortedError -- only retry internal timeouts, never caller aborts.
  return profile.retryTimeouts;
}

function shouldRetryResponse(
  profile: Readonly<Required<ApiRetryProfile>>,
  response: Response
): boolean {
  if (!profile.retryableStatusCodes.has(response.status)) {
    return false;
  }

  // If the response carries a structured API error body (identified by a
  // request-id header), the server intentionally returned this status and
  // retrying is unlikely to help.
  const requestId = response.headers.get(ApiHeaders.requestId);
  if (typeof requestId === "string" && requestId.trim().length > 0) {
    return false;
  }

  return true;
}

function parseApiError(details: unknown): ParsedApiError | null {
  const parsed = ApiErrorResponseSchema.safeParse(details);
  if (!parsed.success) {
    return null;
  }

  return {
    requestId: parsed.data.requestId,
    category: parsed.data.error.category,
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    subtype: parsed.data.error.subtype,
    details: parsed.data.error.details,
  };
}

export function getApiErrorMessage(error: ApiEffectError, fallbackMessage: string): string {
  if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export function getApiErrorReason(
  error: ApiEffectError
): "aborted" | "http" | "network" | "schema" {
  if (error._tag === "ApiAbortedError") {
    return "aborted";
  }
  if (error._tag === "ApiNetworkError") {
    return "network";
  }
  if (error._tag === "ApiSchemaError") {
    return "schema";
  }

  return "http";
}

export function toApiResultFailure<TValue>(
  error: ApiEffectError
): Extract<ApiResult<TValue>, { ok: false }> {
  if (error._tag === "ApiAbortedError") {
    return {
      ok: false,
      requestId: error.requestId,
      reason: "aborted",
      details: error.details,
    };
  }

  if (error._tag === "ApiNetworkError") {
    return {
      ok: false,
      requestId: error.requestId,
      reason: "network",
      details: error.cause,
    };
  }

  if (error._tag === "ApiSchemaError") {
    return {
      ok: false,
      requestId: error.requestId,
      reason: "schema",
      details: error.details,
    };
  }

  const httpFailure: Extract<ApiResult<TValue>, { ok: false }> = {
    ok: false,
    requestId: error.requestId,
    reason: "http",
  };

  if (typeof error.status === "number") {
    httpFailure.status = error.status;
  }
  if (typeof error.code === "string") {
    httpFailure.code = error.code;
  }
  if (typeof error.message === "string") {
    httpFailure.message = error.message;
  }
  if (typeof error.details !== "undefined") {
    httpFailure.details = error.details;
  }

  return httpFailure;
}

export interface ApiRequestOptions {
  readonly requestIdPrefix?: string;
  readonly retryProfile?: ApiRetryProfile;
}

export function apiRequestJsonEffect<TValue>(
  url: string,
  schema: SafeParseSchema<TValue>,
  init: RequestInit = {},
  options: ApiRequestOptions = {}
): Effect<ApiEffectSuccess<TValue>, ApiEffectError, never> {
  const profile = resolveRetryProfile(options.retryProfile);

  // Capture the last Retry-After value so the delay function can use it.
  let lastRetryAfterSeconds: number | undefined;

  return fetchJsonEffect({
    init,
    maxAttempts: profile.maxAttempts,
    requestIdHeaderName: ApiHeaders.requestId,
    requestIdPrefix: options.requestIdPrefix ?? "web",
    retryDelayMs: (attempt: number) => retryDelayMs(profile, attempt, lastRetryAfterSeconds),
    schema,
    shouldRetryError: (error) => shouldRetryError(profile, error),
    shouldRetryResponse: (response) => {
      lastRetryAfterSeconds = parseRetryAfterSeconds(response);
      return shouldRetryResponse(profile, response);
    },
    url,
  }).pipe(
    map(
      (result: FetchJsonEffectSuccess<TValue>) =>
        ({
          data: result.data,
          rawBody: result.rawBody,
          requestId: result.requestId,
          response: result.response,
        }) satisfies ApiEffectSuccess<TValue>
    ),
    catchAll((error): Effect<never, ApiEffectError, never> => {
      switch (error._tag) {
        case "RequestAbortedError":
          return fail(
            new ApiAbortedError({
              requestId: error.requestId,
              details: error.cause,
            })
          );
        case "RequestNetworkError":
          return fail(
            new ApiNetworkError({
              requestId: error.requestId,
              cause: error.cause,
            })
          );
        case "RequestHttpError": {
          const apiError = parseApiError(error.details);
          if (apiError !== null) {
            return fail(
              new ApiHttpError({
                requestId: apiError.requestId,
                status: error.status,
                category: apiError.category,
                code: apiError.code,
                message: apiError.message,
                subtype: apiError.subtype,
                details: apiError.details,
              })
            );
          }

          return fail(
            new ApiHttpError({
              requestId: error.requestId,
              status: error.status,
              message: `HTTP ${String(error.status)} ${error.statusText}`,
              details: error.details,
            })
          );
        }
        case "RequestJsonParseError":
          return fail(
            new ApiSchemaError({
              requestId: error.requestId,
              details: error.cause,
              kind: "json-parse",
            })
          );
        case "RequestSchemaError":
          return fail(
            new ApiSchemaError({
              requestId: error.requestId,
              details: error.cause,
              kind: "schema",
            })
          );
        default:
          return die(error);
      }
    })
  );
}

export async function apiRequestJson<TValue>(
  url: string,
  schema: SafeParseSchema<TValue>,
  init: RequestInit = {},
  options: ApiRequestOptions = {}
): Promise<ApiResult<TValue>> {
  const exit = await runPromiseExit(apiRequestJsonEffect(url, schema, init, options));

  if (isSuccess(exit)) {
    return {
      ok: true,
      requestId: exit.value.requestId,
      data: exit.value.data,
    };
  }

  const failure = failureOption(exit.cause);
  if (isSome(failure)) {
    return toApiResultFailure(failure.value);
  }

  return {
    ok: false,
    requestId: "",
    reason: "network",
    message: "An unexpected error occurred",
  };
}
