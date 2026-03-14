import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import { SpatialAnalysisSummaryRequestSchema, type SpatialAnalysisSummaryResponse, SpatialAnalysisSummaryResponseSchema } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { Context, Env, Hono } from "hono";
import { readExpectedIngestionRunId } from "@/geo/parcels/route/parcels-route-meta.service";
import { jsonError, jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { createAnalysisSummaryPorts } from "./adapters/analysis-summary-adapters";
import { querySpatialAnalysisSummary } from "./analysis-summary.service";

function buildMeta(
  requestId: string,
  payload: Omit<SpatialAnalysisSummaryResponse, "meta">
): SpatialAnalysisSummaryResponse["meta"] {
  const marketWarnings = payload.provenance.markets.warnings;
  const facilitiesTruncated =
    payload.provenance.facilities.truncatedByPerspective.colocation ||
    payload.provenance.facilities.truncatedByPerspective.hyperscale;

  return {
    dataVersion: "dev",
    generatedAt: new Date().toISOString(),
    recordCount: payload.summary.totalCount,
    requestId,
    sourceMode: "postgis",
    truncated:
      payload.summary.parcelSelection.truncated ||
      facilitiesTruncated ||
      marketWarnings.some((warning) => warning.code === "POSSIBLY_TRUNCATED"),
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
    return "facilities analysis policy rejected the request";
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
  app.post(ApiRoutes.analysisSummary, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const requestResult = await readSpatialAnalysisSummaryRequest(honoContext, requestId);

        if (!requestResult.ok) {
          return requestResult.response;
        }

        const ports = createAnalysisSummaryPorts();
        const result = await querySpatialAnalysisSummary(
          {
            expectedParcelIngestionRunId: readExpectedIngestionRunId(honoContext),
            request: requestResult.value,
          },
          ports
        );

        if (!result.ok) {
          throw routeError({
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

        return jsonOk(honoContext, SpatialAnalysisSummaryResponseSchema, payload, requestId);
      })
    )
  );
}
