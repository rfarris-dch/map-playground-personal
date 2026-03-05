import { buildFacilitiesTableRoute, FacilitiesTableResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { FacilitiesTableRequest, FacilitiesTableResult } from "./facilities-table.types";

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
