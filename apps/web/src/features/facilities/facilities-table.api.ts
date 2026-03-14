import { buildFacilitiesTableRoute, FacilitiesTableResponseSchema } from "@map-migration/http-contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  FacilitiesTableRequest,
  FacilitiesTableResult,
} from "@/features/facilities/facilities-table.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

export function fetchFacilitiesTable(
  request: FacilitiesTableRequest
): Promise<FacilitiesTableResult> {
  return apiGetJson(
    buildFacilitiesTableRoute(request.perspective, {
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
    }),
    FacilitiesTableResponseSchema,
    buildApiRequestInit({
      signal: request.signal,
    })
  );
}
