import { apiRequestJson } from "@map-migration/core-runtime/api";
import { buildFacilityDetailRoute } from "@map-migration/http-contracts/api-routes";
import {
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
} from "@map-migration/http-contracts/facilities-http";
import { resolveFacilitiesDatasetVersionPromise } from "@/features/facilities/api";
import type {
  FacilityDetailRequest,
  FacilityDetailResult,
} from "@/features/facilities/facility-detail/detail.types";
import { buildApiRequestInit, withDatasetVersionHeader } from "@/lib/api/api-request-init.service";

export async function fetchFacilityDetail(
  request: FacilityDetailRequest
): Promise<FacilityDetailResult> {
  const datasetVersion = request.datasetVersion ?? (await resolveFacilitiesDatasetVersionPromise());

  return apiRequestJson<FacilitiesDetailResponse>(
    buildFacilityDetailRoute(request.facilityId, {
      datasetVersion,
      perspective: request.perspective,
    }),
    FacilitiesDetailResponseSchema,
    withDatasetVersionHeader(
      buildApiRequestInit({
        signal: request.signal,
      }),
      datasetVersion
    )
  );
}
