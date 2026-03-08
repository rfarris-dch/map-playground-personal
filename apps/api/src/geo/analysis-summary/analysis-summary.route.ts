import {
  ApiRoutes,
  SpatialAnalysisSummaryRequestSchema,
  type SpatialAnalysisSummaryResponse,
  SpatialAnalysisSummaryResponseSchema,
} from "@map-migration/contracts";
import type { Context, Env, Hono } from "hono";
import { readExpectedIngestionRunId } from "@/geo/parcels/route/parcels-route-meta.service";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "@/http/api-response";
import { readJsonBody } from "@/http/json-request.service";
import { querySpatialAnalysisSummary } from "./analysis-summary.service";

function buildMeta(
  requestId: string,
  payload: Omit<SpatialAnalysisSummaryResponse, "meta">
): SpatialAnalysisSummaryResponse["meta"] {
  return {
    dataVersion: "dev",
    generatedAt: new Date().toISOString(),
    recordCount: payload.summary.totalCount,
    requestId,
    sourceMode: "postgis",
    truncated: payload.summary.parcelSelection.truncated,
    warnings: [...payload.warnings],
  };
}

function analysisSummaryErrorHttpStatus(reason: string): number {
  if (reason === "facilities_policy_rejected" || reason === "parcels_policy_rejected") {
    return 422;
  }

  if (reason === "parcel_ingestion_run_mismatch") {
    return 409;
  }

  return 503;
}

function analysisSummaryErrorMessage(reason: string): string {
  if (reason === "facilities_policy_rejected") {
    return "selection polygon AOI payload is too large";
  }

  if (reason === "parcels_policy_rejected") {
    return "parcel analysis policy rejected the request";
  }

  if (reason === "parcel_ingestion_run_mismatch") {
    return "parcel ingestion run mismatch; refresh map tiles or retry";
  }

  return "spatial analysis summary query failed";
}

async function readSpatialAnalysisSummaryRequest(
  c: Context,
  requestId: string
): Promise<
  | {
      readonly ok: true;
      readonly value: typeof SpatialAnalysisSummaryRequestSchema._type;
    }
  | {
      readonly ok: false;
      readonly response: Response;
    }
> {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsed = SpatialAnalysisSummaryRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SPATIAL_ANALYSIS_SUMMARY_REQUEST",
        message: "invalid spatial analysis summary request payload",
        details: toDebugDetails(parsed.error),
      }),
    };
  }

  return {
    ok: true,
    value: parsed.data,
  };
}

export function registerAnalysisSummaryRoute<E extends Env>(app: Hono<E>): void {
  app.post(ApiRoutes.analysisSummary, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const requestResult = await readSpatialAnalysisSummaryRequest(c, requestId);
    if (!requestResult.ok) {
      return requestResult.response;
    }

    const result = await querySpatialAnalysisSummary({
      expectedParcelIngestionRunId: readExpectedIngestionRunId(c),
      request: requestResult.value,
    });

    if (!result.ok) {
      return jsonError(c, {
        requestId,
        httpStatus: analysisSummaryErrorHttpStatus(result.value.reason),
        code: result.value.reason.toUpperCase(),
        message: analysisSummaryErrorMessage(result.value.reason),
        details: toDebugDetails(result.value.error),
      });
    }

    const payload: SpatialAnalysisSummaryResponse = {
      ...result.value,
      meta: buildMeta(requestId, result.value),
    };

    return jsonOk(c, SpatialAnalysisSummaryResponseSchema, payload, requestId);
  });
}
