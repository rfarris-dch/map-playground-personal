import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryRequestSchema,
  type SpatialAnalysisSummaryResponse,
  SpatialAnalysisSummaryResponseSchema,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { Context, Env, Hono } from "hono";
import { bindFacilitiesDatasetVersion } from "@/geo/facilities/route/facilities-dataset-version.service";
import { readExpectedIngestionRunId } from "@/geo/parcels/route/parcels-route-meta.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { buildResponseMeta } from "@/http/response-meta.service";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { createAnalysisSummaryPorts } from "./adapters/analysis-summary-adapters";
import { querySpatialAnalysisSummary } from "./analysis-summary.service";

function buildMeta(
  requestId: string,
  payload: Omit<SpatialAnalysisSummaryResponse, "meta">
): SpatialAnalysisSummaryResponse["meta"] {
  const runtimeConfig = getApiRuntimeConfig();
  const marketWarnings = payload.provenance.markets.warnings;
  const facilitiesTruncated =
    payload.provenance.facilities.truncatedByPerspective.colocation ||
    payload.provenance.facilities.truncatedByPerspective.hyperscale;

  return buildResponseMeta({
    dataVersion: runtimeConfig.dataVersion,
    datasetVersion: payload.provenance.facilities.dataVersion,
    recordCount: payload.summary.totalCount,
    requestId,
    sourceMode: runtimeConfig.analysisSummarySourceMode,
    truncated:
      payload.summary.parcelSelection.truncated ||
      facilitiesTruncated ||
      marketWarnings.some((warning) => warning.code === "POSSIBLY_TRUNCATED"),
    warnings: payload.warnings,
  });
}

function analysisSummaryErrorHttpStatus(reason: string): number {
  if (reason === "facilities_policy_rejected" || reason === "parcels_policy_rejected") {
    return 422;
  }

  if (reason === "parcel_ingestion_run_mismatch") {
    return 409;
  }

  if (reason === "facilities_mapping_failed" || reason === "parcels_mapping_failed") {
    return 500;
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
): Promise<SpatialAnalysisSummaryRequest | Response> {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = SpatialAnalysisSummaryRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SPATIAL_ANALYSIS_SUMMARY_REQUEST",
      message: "invalid spatial analysis summary request payload",
      details: toDebugDetails(parsed.error),
    });
  }

  return parsed.data;
}

export function registerAnalysisSummaryRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(ApiRoutes.analysisSummary, "selection");

  app.post(ApiRoutes.analysisSummary, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const requestOrResponse = await readSpatialAnalysisSummaryRequest(honoContext, requestId);
        if (requestOrResponse instanceof Response) {
          return requestOrResponse;
        }
        const request = requestOrResponse;

        const facilitiesDatasetVersionBinding = await bindFacilitiesDatasetVersion(
          request.facilitiesDatasetVersion ?? null
        );
        const ports = createAnalysisSummaryPorts({
          facilitiesDatasetVersionBinding,
        });
        const result = await querySpatialAnalysisSummary(
          {
            expectedParcelIngestionRunId: readExpectedIngestionRunId(honoContext),
            request,
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
