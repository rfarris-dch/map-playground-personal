import type { Context } from "hono";
import { jsonError, toDebugDetails } from "@/http/api-response";

export function rejectWithBadRequest(c: Context, requestId: string, error: string): Response {
  return jsonError(c, {
    requestId,
    httpStatus: 400,
    code: "BAD_REQUEST",
    message: error,
  });
}

export function rejectWithPolicyError(c: Context, requestId: string, error: string): Response {
  return jsonError(c, {
    requestId,
    httpStatus: 422,
    code: "POLICY_REJECTED",
    message: error,
  });
}

export function rejectWithConflict(
  c: Context,
  requestId: string,
  expectedIngestionRunId: string,
  actualIngestionRunId: string | undefined
): Response {
  return jsonError(c, {
    requestId,
    httpStatus: 409,
    code: "INGESTION_RUN_MISMATCH",
    message: "parcel ingestion run mismatch; refresh map tiles or retry",
    details: {
      expectedIngestionRunId,
      actualIngestionRunId: actualIngestionRunId ?? null,
    },
  });
}

export function postgisQueryFailed(c: Context, requestId: string, error: unknown): Response {
  return jsonError(c, {
    requestId,
    httpStatus: 503,
    code: "POSTGIS_QUERY_FAILED",
    message: "postgis query failed",
    details: toDebugDetails(error),
  });
}

export function parcelMappingFailed(c: Context, requestId: string, error: unknown): Response {
  return jsonError(c, {
    requestId,
    httpStatus: 500,
    code: "PARCEL_MAPPING_FAILED",
    message: "parcel mapping failed",
    details: toDebugDetails(error),
  });
}
