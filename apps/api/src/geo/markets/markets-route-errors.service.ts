import type { Context } from "hono";
import { jsonError, toDebugDetails } from "@/http/api-response";

interface MarketsQueryErrorArgs {
  readonly error: unknown;
  readonly requestId: string;
}

export function marketsBoundarySourceUnavailableError(
  c: Context,
  args: MarketsQueryErrorArgs
): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "MARKET_BOUNDARY_SOURCE_UNAVAILABLE",
    message:
      "market boundary dataset is unavailable; run `bun run sync:market-boundaries` to load market_current.market_boundaries before using market selection",
    details: toDebugDetails(args.error),
  });
}

export function marketsSelectionQueryError(c: Context, args: MarketsQueryErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "MARKET_SELECTION_QUERY_FAILED",
    message: "market selection query failed",
    details: toDebugDetails(args.error),
  });
}

export function marketsSelectionMappingError(c: Context, args: MarketsQueryErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 500,
    code: "MARKET_SELECTION_MAPPING_FAILED",
    message: "market selection mapping failed",
    details: toDebugDetails(args.error),
  });
}
