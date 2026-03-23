import { apiRequestJson } from "@map-migration/core-runtime/api";
import { buildFacilitiesTableRoute } from "@map-migration/http-contracts/api-routes";
import { FacilitiesTableResponseSchema } from "@map-migration/http-contracts/table-contracts";
import { resolveFacilitiesDatasetVersionPromise } from "@/features/facilities/api";
import type {
  FacilitiesTableRequest,
  FacilitiesTableResult,
} from "@/features/facilities/facilities-table.types";
import { buildApiRequestInit, withDatasetVersionHeader } from "@/lib/api/api-request-init.service";

export function fetchFacilitiesTable(
  request: FacilitiesTableRequest
): Promise<FacilitiesTableResult> {
  return resolveFacilitiesDatasetVersionPromise().then((datasetVersion) =>
    apiRequestJson(
      buildFacilitiesTableRoute(request.perspective, {
        page: request.page,
        pageSize: request.pageSize,
        sortBy: request.sortBy,
        sortOrder: request.sortOrder,
        datasetVersion,
      }),
      FacilitiesTableResponseSchema,
      withDatasetVersionHeader(
        buildApiRequestInit({
          signal: request.signal,
        }),
        datasetVersion
      )
    )
  );
}
