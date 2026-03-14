import { toDebugDetails } from "@/http/api-response";
import { type ApiRouteError, routeError } from "@/http/effect-route";

export function rejectWithBadRequest(message: string): ApiRouteError {
  return routeError({
    httpStatus: 400,
    code: "BAD_REQUEST",
    message,
  });
}

export function rejectWithPolicyError(message: string): ApiRouteError {
  return routeError({
    httpStatus: 422,
    code: "POLICY_REJECTED",
    message,
  });
}

export function rejectWithConflict(
  expectedIngestionRunId: string,
  actualIngestionRunId: string | undefined
): ApiRouteError {
  return routeError({
    httpStatus: 409,
    code: "INGESTION_RUN_MISMATCH",
    message: "parcel ingestion run mismatch; refresh map tiles or retry",
    details: {
      expectedIngestionRunId,
      actualIngestionRunId: actualIngestionRunId ?? null,
    },
  });
}

export function postgisQueryFailed(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 503,
    code: "POSTGIS_QUERY_FAILED",
    message: "postgis query failed",
    details: toDebugDetails(error),
  });
}

export function parcelMappingFailed(error: unknown): ApiRouteError {
  return routeError({
    httpStatus: 500,
    code: "PARCEL_MAPPING_FAILED",
    message: "parcel mapping failed",
    details: toDebugDetails(error),
  });
}
