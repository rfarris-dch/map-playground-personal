import { Data } from "effect";
import type { ApiResult } from "@/lib/api-client.types";

export interface ApiFailureShape {
  readonly code?: string;
  readonly details?: unknown;
  readonly message?: string;
  readonly requestId: string;
  readonly status?: number;
}

export class ApiAbortedError extends Data.TaggedError("ApiAbortedError")<{
  readonly details?: unknown;
  readonly requestId: string;
}> {}

export class ApiNetworkError extends Data.TaggedError("ApiNetworkError")<{
  readonly cause: unknown;
  readonly requestId: string;
}> {}

export class ApiHttpError extends Data.TaggedError("ApiHttpError")<ApiFailureShape> {}

export class ApiPolicyRejectedError extends Data.TaggedError(
  "ApiPolicyRejectedError"
)<ApiFailureShape> {}

export class ApiSchemaError extends Data.TaggedError("ApiSchemaError")<{
  readonly details: unknown;
  readonly requestId: string;
}> {}

export class ApiIngestionRunMismatchError extends Data.TaggedError("ApiIngestionRunMismatchError")<{
  readonly actualIngestionRunId: string | null;
  readonly expectedIngestionRunId: string | null;
  readonly requestId: string;
}> {}

export type ApiEffectError =
  | ApiAbortedError
  | ApiHttpError
  | ApiIngestionRunMismatchError
  | ApiNetworkError
  | ApiPolicyRejectedError
  | ApiSchemaError;

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  return Reflect.get(error, "name") === "AbortError";
}

export function createAbortError(): Error | DOMException {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }

  const error = new Error("The operation was aborted.");
  Object.defineProperty(error, "name", {
    configurable: true,
    enumerable: false,
    value: "AbortError",
    writable: true,
  });
  return error;
}

export function getApiErrorMessage(error: ApiEffectError, fallbackMessage: string): string {
  if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export function getApiErrorReason(
  error: ApiEffectError
): "aborted" | "http" | "ingestion-run-mismatch" | "network" | "schema" {
  if (error._tag === "ApiAbortedError") {
    return "aborted";
  }
  if (error._tag === "ApiNetworkError") {
    return "network";
  }
  if (error._tag === "ApiSchemaError") {
    return "schema";
  }
  if (error._tag === "ApiIngestionRunMismatchError") {
    return "ingestion-run-mismatch";
  }

  return "http";
}

export function toApiResultFailure<TValue>(
  error: Exclude<ApiEffectError, ApiIngestionRunMismatchError>
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
