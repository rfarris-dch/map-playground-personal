import {
  type ApiEffectError,
  type ApiEffectSuccess,
  ApiNetworkError,
  apiRequestJsonEffect,
} from "@map-migration/core-runtime/api";
import { buildSpatialAnalysisSummaryRoute } from "@map-migration/http-contracts/api-routes";
import {
  type SpatialAnalysisSummaryRequest,
  type SpatialAnalysisSummaryResponse,
  SpatialAnalysisSummaryResponseSchema,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import { Effect } from "effect";
import { resolveFacilitiesDatasetVersionPromise } from "@/features/facilities/api";
import {
  buildJsonPostRequestInit,
  withDatasetVersionHeader,
  withParcelIngestionRunIdHeader,
} from "@/lib/api/api-request-init.service";

interface FetchSpatialAnalysisSummaryOptions {
  readonly expectedParcelIngestionRunId: string | null;
  readonly signal?: AbortSignal;
}

function withFacilitiesDatasetVersion(
  request: SpatialAnalysisSummaryRequest,
  facilitiesDatasetVersion: string
): SpatialAnalysisSummaryRequest {
  if (request.facilitiesDatasetVersion === facilitiesDatasetVersion) {
    return request;
  }

  return {
    ...request,
    facilitiesDatasetVersion,
  };
}

function buildSpatialAnalysisSummaryRequestInit(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions,
  facilitiesDatasetVersion: string
): RequestInit {
  return withDatasetVersionHeader(
    withParcelIngestionRunIdHeader(
      buildJsonPostRequestInit({
        body: withFacilitiesDatasetVersion(request, facilitiesDatasetVersion),
        signal: options.signal,
      }),
      options.expectedParcelIngestionRunId
    ),
    facilitiesDatasetVersion
  );
}

export function fetchSpatialAnalysisSummaryEffect(
  request: SpatialAnalysisSummaryRequest,
  options: FetchSpatialAnalysisSummaryOptions
): Effect.Effect<ApiEffectSuccess<SpatialAnalysisSummaryResponse>, ApiEffectError, never> {
  return Effect.tryPromise({
    try: () => resolveFacilitiesDatasetVersionPromise(),
    catch: (error) =>
      new ApiNetworkError({
        cause: error,
        requestId: "",
      }),
  }).pipe(
    Effect.flatMap((facilitiesDatasetVersion) =>
      apiRequestJsonEffect(
        buildSpatialAnalysisSummaryRoute(),
        SpatialAnalysisSummaryResponseSchema,
        buildSpatialAnalysisSummaryRequestInit(request, options, facilitiesDatasetVersion)
      )
    )
  );
}
