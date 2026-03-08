import { toDebugDetails } from "@/http/api-response";
import { type ApiRouteError, routeError } from "@/http/effect-route";

export function buildFacilitiesPostgisQueryRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "POSTGIS_QUERY_FAILED",
    message: "postgis query failed",
    details: toDebugDetails(error),
  });
}

export function buildFacilitiesMappingRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 500,
    code: "FACILITY_MAPPING_FAILED",
    message: "facility mapping failed",
    details: toDebugDetails(error),
  });
}

export function buildFacilitiesTableQueryRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "FACILITY_QUERY_FAILED",
    message: "facility query failed",
    details: toDebugDetails(error),
  });
}
