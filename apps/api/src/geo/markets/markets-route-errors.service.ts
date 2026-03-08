import { toDebugDetails } from "@/http/api-response";
import { type ApiRouteError, routeError } from "@/http/effect-route";

export function buildMarketsBoundarySourceUnavailableRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "MARKET_BOUNDARY_SOURCE_UNAVAILABLE",
    message:
      "market boundary dataset is unavailable; run `bun run sync:market-boundaries` to load market_current.market_boundaries before using market selection",
    details: toDebugDetails(error),
  });
}

export function buildMarketsSelectionQueryRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "MARKET_SELECTION_QUERY_FAILED",
    message: "market selection query failed",
    details: toDebugDetails(error),
  });
}

export function buildMarketsSelectionMappingRouteError(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 500,
    code: "MARKET_SELECTION_MAPPING_FAILED",
    message: "market selection mapping failed",
    details: toDebugDetails(error),
  });
}
