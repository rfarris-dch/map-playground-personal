import type { Context } from "hono";
import { jsonError, toDebugDetails } from "@/http/api-response";
import type { FacilitiesQueryErrorArgs } from "./facilities-route-errors.service.types";

export function facilitiesPostgisQueryError(c: Context, args: FacilitiesQueryErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "POSTGIS_QUERY_FAILED",
    message: "postgis query failed",
    details: toDebugDetails(args.error),
  });
}

export function facilitiesMappingError(c: Context, args: FacilitiesQueryErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 500,
    code: "FACILITY_MAPPING_FAILED",
    message: "facility mapping failed",
    details: toDebugDetails(args.error),
  });
}

export function facilitiesTableQueryError(c: Context, args: FacilitiesQueryErrorArgs): Response {
  return jsonError(c, {
    requestId: args.requestId,
    httpStatus: 503,
    code: "FACILITY_QUERY_FAILED",
    message: "facility query failed",
    details: toDebugDetails(args.error),
  });
}
