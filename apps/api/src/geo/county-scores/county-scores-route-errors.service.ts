import type { Context } from "hono";
import { jsonError, toDebugDetails } from "@/http/api-response";

interface CountyScoresRouteErrorArgs {
  readonly error: unknown;
  readonly requestId: string;
}

export function countyScoresSourceUnavailableError(
  c: Context,
  args: CountyScoresRouteErrorArgs
): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "COUNTY_SCORES_SOURCE_UNAVAILABLE",
    message:
      "county intelligence dataset is unavailable; publish analytics_meta.county_score_publications before using county score queries",
    details: toDebugDetails(args.error),
  });
}

export function countyScoresStatusSourceUnavailableError(
  c: Context,
  args: CountyScoresRouteErrorArgs
): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "COUNTY_SCORES_STATUS_SOURCE_UNAVAILABLE",
    message:
      "county intelligence status is unavailable; initialize and publish county scores before requesting status",
    details: toDebugDetails(args.error),
  });
}

export function countyScoresQueryError(c: Context, args: CountyScoresRouteErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "COUNTY_SCORES_QUERY_FAILED",
    message: "county scores query failed",
    details: toDebugDetails(args.error),
  });
}

export function countyScoresStatusQueryError(
  c: Context,
  args: CountyScoresRouteErrorArgs
): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "COUNTY_SCORES_STATUS_QUERY_FAILED",
    message: "county scores status query failed",
    details: toDebugDetails(args.error),
  });
}

export function countyScoresMappingError(c: Context, args: CountyScoresRouteErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 500,
    code: "COUNTY_SCORES_MAPPING_FAILED",
    message: "county scores mapping failed",
    details: toDebugDetails(args.error),
  });
}

export function countyScoresStatusMappingError(
  c: Context,
  args: CountyScoresRouteErrorArgs
): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 500,
    code: "COUNTY_SCORES_STATUS_MAPPING_FAILED",
    message: "county scores status mapping failed",
    details: toDebugDetails(args.error),
  });
}
