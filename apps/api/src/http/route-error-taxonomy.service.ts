import { toDebugDetails } from "@/http/api-response";
import { type ApiRouteError, routeError } from "@/http/effect-route";

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
