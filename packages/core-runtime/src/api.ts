import type { SafeParseSchema } from "@map-migration/geo-kernel";
import { ApiErrorResponseSchema, ApiHeaders } from "@map-migration/http-contracts";
import { TaggedError } from "effect/Data";
import { catchAll, die, type Effect, either, fail, map } from "effect/Effect";
import { type Either, isRight } from "effect/Either";
import { type FetchJsonEffectSuccess, fetchJsonEffect, runEffectPromise } from "./effect";

export interface ParsedApiError {
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
  readonly requestId: string;
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
  readonly code?: string;
  readonly details?: unknown;
  readonly message?: string;
  readonly requestId: string;
  readonly status?: number;
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

export class ApiPolicyRejectedError extends TaggedError(
  "ApiPolicyRejectedError"
)<ApiFailureShape> {}

export class ApiSchemaError extends TaggedError("ApiSchemaError")<{
  readonly details: unknown;
  readonly kind: "json-parse" | "schema";
  readonly requestId: string;
}> {}

export type ApiEffectError =
  | ApiAbortedError
  | ApiHttpError
  | ApiNetworkError
  | ApiPolicyRejectedError
  | ApiSchemaError;

const API_GET_RETRY_ATTEMPTS = 3;
const API_GET_RETRY_BASE_DELAY_MS = 150;

function retryApiGetDelayMs(attempt: number): number {
  return API_GET_RETRY_BASE_DELAY_MS * (attempt + 1);
}

function shouldRetryApiGetResponse(response: Response): boolean {
  if (response.status < 500 || response.status > 504) {
    return false;
  }

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
    code: parsed.data.error.code,
    message: parsed.data.error.message,
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

export function apiGetJsonEffect<TValue>(
  url: string,
  schema: SafeParseSchema<TValue>,
  init: RequestInit = {},
  options: { requestIdPrefix?: string } = {}
): Effect<ApiEffectSuccess<TValue>, ApiEffectError, never> {
  return fetchJsonEffect({
    init,
    maxAttempts: API_GET_RETRY_ATTEMPTS,
    requestIdHeaderName: ApiHeaders.requestId,
    requestIdPrefix: options.requestIdPrefix ?? "web",
    retryDelayMs: retryApiGetDelayMs,
    schema,
    shouldRetryError: (error) => error._tag === "RequestNetworkError",
    shouldRetryResponse: shouldRetryApiGetResponse,
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
            if (apiError.code === "POLICY_REJECTED") {
              return fail(
                new ApiPolicyRejectedError({
                  requestId: apiError.requestId,
                  status: error.status,
                  code: apiError.code,
                  message: apiError.message,
                  details: apiError.details,
                })
              );
            }

            return fail(
              new ApiHttpError({
                requestId: apiError.requestId,
                status: error.status,
                code: apiError.code,
                message: apiError.message,
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

export async function apiGetJson<TValue>(
  url: string,
  schema: SafeParseSchema<TValue>,
  init: RequestInit = {},
  options: { requestIdPrefix?: string } = {}
): Promise<ApiResult<TValue>> {
  const result: Either<ApiEffectSuccess<TValue>, ApiEffectError> = await runEffectPromise(
    either(apiGetJsonEffect(url, schema, init, options))
  );

  if (isRight(result)) {
    return {
      ok: true,
      requestId: result.right.requestId,
      data: result.right.data,
    };
  }

  return toApiResultFailure(result.left);
}
