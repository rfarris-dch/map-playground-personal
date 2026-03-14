import { buildProvidersRoute } from "@map-migration/http-contracts/api-routes";
import { ProvidersTableResponseSchema } from "@map-migration/http-contracts/table-contracts";
import type {
  ProvidersTableRequest,
  ProvidersTableResult,
} from "@/features/providers/providers.types";
import { createTableFetcher } from "@/lib/api/table-fetcher.service";

const providersTableFetcher = createTableFetcher((request: ProvidersTableRequest) => {
  return buildProvidersRoute({
    page: request.page,
    pageSize: request.pageSize,
    sortBy: request.sortBy,
    sortOrder: request.sortOrder,
  });
}, ProvidersTableResponseSchema);

export function fetchProvidersTable(request: ProvidersTableRequest): Promise<ProvidersTableResult> {
  return providersTableFetcher(request);
}
