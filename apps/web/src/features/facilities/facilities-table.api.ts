import { buildFacilitiesTableRoute } from "@map-migration/http-contracts/api-routes";
import { FacilitiesTableResponseSchema } from "@map-migration/http-contracts/table-contracts";
import type {
  FacilitiesTableRequest,
  FacilitiesTableResult,
} from "@/features/facilities/facilities-table.types";
import { createTableFetcher } from "@/lib/api/table-fetcher.service";

const facilitiesTableFetcher = createTableFetcher((request: FacilitiesTableRequest) => {
  return buildFacilitiesTableRoute(request.perspective, {
    page: request.page,
    pageSize: request.pageSize,
    sortBy: request.sortBy,
    sortOrder: request.sortOrder,
  });
}, FacilitiesTableResponseSchema);

export function fetchFacilitiesTable(
  request: FacilitiesTableRequest
): Promise<FacilitiesTableResult> {
  return facilitiesTableFetcher(request);
}
