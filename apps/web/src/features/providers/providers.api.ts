import { buildProvidersRoute } from "@map-migration/http-contracts/api-routes";
import { ProvidersTableResponseSchema } from "@map-migration/http-contracts/table-contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  ProvidersTableRequest,
  ProvidersTableResult,
} from "@/features/providers/providers.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

export function fetchProvidersTable(request: ProvidersTableRequest): Promise<ProvidersTableResult> {
  return apiGetJson(
    buildProvidersRoute({
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
    }),
    ProvidersTableResponseSchema,
    buildApiRequestInit({
      signal: request.signal,
    })
  );
}
