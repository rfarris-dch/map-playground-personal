import { buildSpatialAnalysisSummaryRoute } from "@map-migration/http-contracts/api-routes";
import { type SpatialAnalysisSummaryRequest, type SpatialAnalysisSummaryResponse, SpatialAnalysisSummaryResponseSchema } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { ApiEffectError, ApiEffectSuccess } from "@map-migration/core-runtime/api";
import { type ApiResult, apiGetJson, apiGetJsonEffect } from "@map-migration/core-runtime/api";
import type { Effect } from "effect";
import {
  buildJsonPostRequestInit,
  withParcelIngestionRunIdHeader,
} from "@/lib/api/api-request-init.service";

export interface FetchSpatialAnalysisSummaryOptions {
  readonly expectedParcelIngestionRunId: string | null;
  readonly signal?: AbortSignal;
}

export type SpatialAnalysisSummaryResult = ApiResult<SpatialAnalysisSummaryResponse>;

function buildSpatialAnalysisSummaryRequestInit(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions
): RequestInit {
  return withParcelIngestionRunIdHeader(
    buildJsonPostRequestInit({
      body: request,
      signal: options.signal,
    }),
    options.expectedParcelIngestionRunId
  );
}

export function fetchSpatialAnalysisSummary(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions
): Promise<SpatialAnalysisSummaryResult> {
  return apiGetJson(
    buildSpatialAnalysisSummaryRoute(),
    SpatialAnalysisSummaryResponseSchema,
    buildSpatialAnalysisSummaryRequestInit(request, options)
  );
}

export function fetchSpatialAnalysisSummaryEffect(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions
): Effect.Effect<ApiEffectSuccess<SpatialAnalysisSummaryResponse>, ApiEffectError, never> {
  return apiGetJsonEffect(
    buildSpatialAnalysisSummaryRoute(),
    SpatialAnalysisSummaryResponseSchema,
    buildSpatialAnalysisSummaryRequestInit(request, options)
  );
}
