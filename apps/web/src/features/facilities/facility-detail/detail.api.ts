import { buildFacilityDetailRoute, FacilitiesDetailResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  FacilityDetailRequest,
  FacilityDetailResult,
} from "@/features/facilities/facility-detail/detail.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

export function fetchFacilityDetail(request: FacilityDetailRequest): Promise<FacilityDetailResult> {
  return apiGetJson(
    buildFacilityDetailRoute(request.facilityId, {
      perspective: request.perspective,
    }),
    FacilitiesDetailResponseSchema,
    buildApiRequestInit({
      signal: request.signal,
    })
  );
}
