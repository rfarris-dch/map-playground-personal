import { toDebugDetails } from "@/http/api-response";
import { type ApiRouteError, routeError } from "@/http/effect-route";

/**
 * Normalized top-level error categories.
 *
 * Frontend code can switch on `category` to apply a consistent retry/message
 * policy across all features, while `subtype` carries feature-specific detail.
 *
 * The `code` field retains a backward-compatible feature-specific value so
 * existing frontend consumers that match on `error.code` continue to work.
 */
export type ApiErrorCategory =
  | "CONFLICT_ERROR"
  | "MAPPING_ERROR"
  | "NOT_FOUND_ERROR"
  | "POLICY_ERROR"
  | "QUERY_ERROR"
  | "TIMEOUT_ERROR"
  | "UPSTREAM_ERROR"
  | "VALIDATION_ERROR";

// ---------------------------------------------------------------------------
// VALIDATION_ERROR  (HTTP 400)
// ---------------------------------------------------------------------------

export function validationError(
  subtype: string,
  message: string,
  details?: unknown
): ApiRouteError {
  return routeError({
    category: "VALIDATION_ERROR",
    code: "VALIDATION_ERROR",
    details,
    httpStatus: 400,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// POLICY_ERROR  (HTTP 422)
// ---------------------------------------------------------------------------

export function policyError(subtype: string, message: string): ApiRouteError {
  return routeError({
    category: "POLICY_ERROR",
    code: "POLICY_REJECTED",
    httpStatus: 422,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// NOT_FOUND_ERROR  (HTTP 404)
// ---------------------------------------------------------------------------

export function notFoundError(subtype: string, message: string): ApiRouteError {
  return routeError({
    category: "NOT_FOUND_ERROR",
    code: "NOT_FOUND_ERROR",
    httpStatus: 404,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// CONFLICT_ERROR  (HTTP 409)
// ---------------------------------------------------------------------------

export function conflictError(subtype: string, message: string, details?: unknown): ApiRouteError {
  return routeError({
    category: "CONFLICT_ERROR",
    code: "CONFLICT_ERROR",
    details,
    httpStatus: 409,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// QUERY_ERROR  (HTTP 503)
// ---------------------------------------------------------------------------

export function queryError(subtype: string, message: string, error: unknown): ApiRouteError {
  return routeError({
    category: "QUERY_ERROR",
    code: "QUERY_ERROR",
    details: toDebugDetails(error),
    httpStatus: 503,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// MAPPING_ERROR  (HTTP 500)
// ---------------------------------------------------------------------------

export function mappingError(subtype: string, message: string, error: unknown): ApiRouteError {
  return routeError({
    category: "MAPPING_ERROR",
    code: "MAPPING_ERROR",
    details: toDebugDetails(error),
    httpStatus: 500,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// UPSTREAM_ERROR  (HTTP 502 | 503)
// ---------------------------------------------------------------------------

export function upstreamError(
  subtype: string,
  message: string,
  args: { readonly error?: unknown; readonly httpStatus?: 502 | 503 }
): ApiRouteError {
  return routeError({
    category: "UPSTREAM_ERROR",
    code: "UPSTREAM_ERROR",
    details: args.error === undefined ? undefined : toDebugDetails(args.error),
    httpStatus: args.httpStatus ?? 502,
    message,
    subtype,
  });
}

/**
 * Variant for upstream responses that returned a non-OK status -- carries the
 * upstream status in the details payload rather than a caught error.
 */
export function upstreamStatusError(
  subtype: string,
  message: string,
  upstreamStatus: number
): ApiRouteError {
  return routeError({
    category: "UPSTREAM_ERROR",
    code: "UPSTREAM_ERROR",
    details: { upstreamStatus },
    httpStatus: 502,
    message,
    subtype,
  });
}

// ---------------------------------------------------------------------------
// TIMEOUT_ERROR  (HTTP 408)
// ---------------------------------------------------------------------------

export function timeoutError(subtype: string, message: string): ApiRouteError {
  return routeError({
    category: "TIMEOUT_ERROR",
    code: "TIMEOUT_ERROR",
    httpStatus: 408,
    message,
    subtype,
  });
}
