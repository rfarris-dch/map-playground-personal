import { buildProvidersRoute, ProvidersTableResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  ProvidersTableRequest,
  ProvidersTableResult,
} from "@/features/providers/providers.types";

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
