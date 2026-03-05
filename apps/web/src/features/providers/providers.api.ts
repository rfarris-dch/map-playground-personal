import { buildProvidersRoute, ProvidersTableResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { ProvidersTableRequest, ProvidersTableResult } from "./providers.types";

export function fetchProvidersTable(request: ProvidersTableRequest): Promise<ProvidersTableResult> {
  const requestInit: RequestInit = {};
  if (request.signal) {
    requestInit.signal = request.signal;
  }

  return apiGetJson(
    buildProvidersRoute({
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
    }),
    ProvidersTableResponseSchema,
    requestInit
  );
}
