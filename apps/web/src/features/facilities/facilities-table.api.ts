import { buildFacilitiesTableRoute, FacilitiesTableResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  FacilitiesTableRequest,
  FacilitiesTableResult,
} from "@/features/facilities/facilities-table.types";

export function fetchFacilitiesTable(
  request: FacilitiesTableRequest
): Promise<FacilitiesTableResult> {
  const requestInit: RequestInit = {};
  if (request.signal) {
    requestInit.signal = request.signal;
  }

  return apiGetJson(
    buildFacilitiesTableRoute(request.perspective, {
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
    }),
    FacilitiesTableResponseSchema,
    requestInit
  );
}
