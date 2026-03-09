import { buildFacilityDetailRoute, FacilitiesDetailResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  FacilityDetailRequest,
  FacilityDetailResult,
} from "@/features/facilities/facility-detail/detail.types";

export function fetchFacilityDetail(request: FacilityDetailRequest): Promise<FacilityDetailResult> {
  const requestInit: RequestInit = {};
  if (request.signal) {
    requestInit.signal = request.signal;
  }

  return apiGetJson(
    buildFacilityDetailRoute(request.facilityId, {
      perspective: request.perspective,
    }),
    FacilitiesDetailResponseSchema,
    requestInit
  );
}
