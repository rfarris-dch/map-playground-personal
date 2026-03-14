import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type FacilitiesTableRequest,
  FacilitiesTableRequestSchema,
  type FacilitiesTableResponse,
  FacilitiesTableResponseSchema,
} from "@map-migration/http-contracts/table-contracts";
import type { Context, Env, Hono } from "hono";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesTableQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { queryFacilitiesTable } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { totalPages } from "@/http/pagination-params.service";

function resolveFacilitiesTableQuery(honoContext: Context): FacilitiesTableRequest {
  const request = FacilitiesTableRequestSchema.safeParse({
    page: honoContext.req.query("page"),
    pageSize: honoContext.req.query("pageSize"),
    perspective: honoContext.req.query("perspective"),
    sortBy: honoContext.req.query("sortBy"),
    sortOrder: honoContext.req.query("sortOrder"),
  });
  if (!request.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_FACILITIES_TABLE_REQUEST",
      message: "invalid facilities table request",
      details: toDebugDetails(request.error),
    });
  }

  return request.data;
}

export function registerFacilitiesTableRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilitiesTable, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const query = resolveFacilitiesTableQuery(honoContext);
        const offset = query.page * query.pageSize;

        const queryResult = await queryFacilitiesTable({
          perspective: query.perspective,
          limit: query.pageSize,
          offset,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        });

        if (!queryResult.ok) {
          throw queryResult.value.reason === "query_failed"
            ? buildFacilitiesTableQueryRouteError(queryResult.value.error)
            : buildFacilitiesMappingRouteError(queryResult.value.error);
        }

        const payload: FacilitiesTableResponse = {
          rows: [...queryResult.value.rows],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            totalCount: queryResult.value.totalCount,
            totalPages: totalPages(queryResult.value.totalCount, query.pageSize),
          },
        };

        return jsonOk(honoContext, FacilitiesTableResponseSchema, payload, requestId);
      })
    )
  );
}
