import { toDebugDetails } from "@/http/api-response";
import { type ApiRouteError, routeError } from "@/http/effect-route";

export function buildCountyScoresSourceUnavailableRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "COUNTY_SCORES_SOURCE_UNAVAILABLE",
    message:
      "county intelligence dataset is unavailable; publish analytics_meta.county_score_publications before using county score queries",
    details: toDebugDetails(error),
  });
}

export function buildCountyScoresStatusSourceUnavailableRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "COUNTY_SCORES_STATUS_SOURCE_UNAVAILABLE",
    message:
      "county intelligence status is unavailable; initialize and publish county scores before requesting status",
    details: toDebugDetails(error),
  });
}

export function buildCountyScoresQueryRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "COUNTY_SCORES_QUERY_FAILED",
    message: "county scores query failed",
    details: toDebugDetails(error),
  });
}

export function buildCountyScoresStatusQueryRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "COUNTY_SCORES_STATUS_QUERY_FAILED",
    message: "county scores status query failed",
    details: toDebugDetails(error),
  });
}

export function buildCountyScoresMappingRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 500,
    code: "COUNTY_SCORES_MAPPING_FAILED",
    message: "county scores mapping failed",
    details: toDebugDetails(error),
  });
}

export function buildCountyScoresStatusMappingRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 500,
    code: "COUNTY_SCORES_STATUS_MAPPING_FAILED",
    message: "county scores status mapping failed",
    details: toDebugDetails(error),
  });
}
