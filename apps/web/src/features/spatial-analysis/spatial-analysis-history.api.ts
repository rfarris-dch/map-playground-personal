import type { ApiEffectError, ApiEffectSuccess } from "@map-migration/core-runtime/api";
import {
  type ApiResult,
  apiRequestJson,
  apiRequestJsonEffect,
} from "@map-migration/core-runtime/api";
import { buildSpatialAnalysisHistoryRoute } from "@map-migration/http-contracts/api-routes";
import {
  type SpatialAnalysisHistoryRequest,
  type SpatialAnalysisHistoryResponse,
  SpatialAnalysisHistoryResponseSchema,
} from "@map-migration/http-contracts/spatial-analysis-history-http";
import type { Effect } from "effect";
import { buildJsonPostRequestInit } from "@/lib/api/api-request-init.service";

export interface FetchSpatialAnalysisHistoryOptions {
  readonly signal?: AbortSignal;
}

export type SpatialAnalysisHistoryResult = ApiResult<SpatialAnalysisHistoryResponse>;

function buildSpatialAnalysisHistoryRequestInit(
  request: SpatialAnalysisHistoryRequest,
  options: FetchSpatialAnalysisHistoryOptions
): RequestInit {
  return buildJsonPostRequestInit({
    body: request,
    signal: options.signal,
  });
}

export function fetchSpatialAnalysisHistory(
  request: SpatialAnalysisHistoryRequest,
  options: FetchSpatialAnalysisHistoryOptions
): Promise<SpatialAnalysisHistoryResult> {
  return apiRequestJson(
    buildSpatialAnalysisHistoryRoute(),
    SpatialAnalysisHistoryResponseSchema,
    buildSpatialAnalysisHistoryRequestInit(request, options)
  );
}

export function fetchSpatialAnalysisHistoryEffect(
  request: SpatialAnalysisHistoryRequest,
  options: FetchSpatialAnalysisHistoryOptions
): Effect.Effect<ApiEffectSuccess<SpatialAnalysisHistoryResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildSpatialAnalysisHistoryRoute(),
    SpatialAnalysisHistoryResponseSchema,
    buildSpatialAnalysisHistoryRequestInit(request, options)
  );
}
