import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  SpatialAnalysisHistoryRequestSchema,
  type SpatialAnalysisHistoryResponse,
  SpatialAnalysisHistoryResponseSchema,
} from "@map-migration/http-contracts/spatial-analysis-history-http";
import type { Context, Env, Hono } from "hono";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { buildResponseMeta } from "@/http/response-meta.service";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { querySpatialAnalysisHistory } from "./analysis-history.service";

async function readSpatialAnalysisHistoryRequest(
  c: Context,
  requestId: string
): Promise<typeof SpatialAnalysisHistoryRequestSchema._type | Response> {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = SpatialAnalysisHistoryRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SPATIAL_ANALYSIS_HISTORY_REQUEST",
      message: "invalid spatial analysis history request payload",
      details: toDebugDetails(parsed.error),
    });
  }

  return parsed.data;
}

export function registerAnalysisHistoryRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(ApiRoutes.analysisHistory, "selection");

  app.post(ApiRoutes.analysisHistory, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const requestOrResponse = await readSpatialAnalysisHistoryRequest(honoContext, requestId);
        if (requestOrResponse instanceof Response) {
          return requestOrResponse;
        }

        const request = requestOrResponse;
        const result = await querySpatialAnalysisHistory(request);
        const runtimeConfig = getApiRuntimeConfig();

        const payload: SpatialAnalysisHistoryResponse = {
          meta: buildResponseMeta({
            dataVersion: runtimeConfig.dataVersion,
            recordCount: result.summary.pointCount,
            requestId,
            sourceMode: runtimeConfig.analysisSummarySourceMode,
            truncated: false,
            warnings: result.warnings,
          }),
          request,
          summary: result.summary,
          warnings: [...result.warnings],
        };

        return jsonOk(honoContext, SpatialAnalysisHistoryResponseSchema, payload, requestId);
      })
    )
  );
}
