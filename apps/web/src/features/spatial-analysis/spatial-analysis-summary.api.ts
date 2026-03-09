import {
  ApiHeaders,
  buildSpatialAnalysisSummaryRoute,
  type SpatialAnalysisSummaryRequest,
  type SpatialAnalysisSummaryResponse,
  SpatialAnalysisSummaryResponseSchema,
} from "@map-migration/contracts";
import type { ApiEffectError, ApiEffectSuccess } from "@map-migration/core-runtime/api";
import { type ApiResult, apiGetJson, apiGetJsonEffect } from "@map-migration/core-runtime/api";
import type { Effect } from "effect";

export interface FetchSpatialAnalysisSummaryOptions {
  readonly expectedParcelIngestionRunId: string | null;
  readonly signal?: AbortSignal;
}

export type SpatialAnalysisSummaryResult = ApiResult<SpatialAnalysisSummaryResponse>;

export function fetchSpatialAnalysisSummary(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions
): Promise<SpatialAnalysisSummaryResult> {
  const requestInit: RequestInit = {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  };

  if (options.signal) {
    requestInit.signal = options.signal;
  }

  if (
    typeof options.expectedParcelIngestionRunId === "string" &&
    options.expectedParcelIngestionRunId.trim().length > 0
  ) {
    requestInit.headers = {
      ...requestInit.headers,
      [ApiHeaders.parcelIngestionRunId]: options.expectedParcelIngestionRunId.trim(),
    };
  }

  return apiGetJson(
    buildSpatialAnalysisSummaryRoute(),
    SpatialAnalysisSummaryResponseSchema,
    requestInit
  );
}

export function fetchSpatialAnalysisSummaryEffect(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions
): Effect.Effect<ApiEffectSuccess<SpatialAnalysisSummaryResponse>, ApiEffectError, never> {
  const requestInit: RequestInit = {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  };

  if (typeof options.signal !== "undefined") {
    requestInit.signal = options.signal;
  }

  if (
    typeof options.expectedParcelIngestionRunId === "string" &&
    options.expectedParcelIngestionRunId.trim().length > 0
  ) {
    requestInit.headers = {
      ...requestInit.headers,
      [ApiHeaders.parcelIngestionRunId]: options.expectedParcelIngestionRunId.trim(),
    };
  }

  return apiGetJsonEffect(
    buildSpatialAnalysisSummaryRoute(),
    SpatialAnalysisSummaryResponseSchema,
    requestInit
  );
}
