import {
  ApiRoutes,
  type FacilitiesTableResponse,
  FacilitiesTableResponseSchema,
} from "@map-migration/contracts";
import type { Context, Env, Hono } from "hono";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesTableQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import {
  resolveFacilitySortBy,
  resolvePerspectiveParam,
  resolveSortDirection,
} from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilitiesTable } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { resolvePaginationParams, totalPages } from "@/http/pagination-params.service";

function resolveFacilitiesTableQuery(honoContext: Context) {
  const perspectiveResolution = resolvePerspectiveParam(honoContext.req.query("perspective"));
  if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_PERSPECTIVE",
      message: perspectiveResolution.error ?? "perspective query param is invalid",
    });
  }

  const paginationResolution = resolvePaginationParams(
    honoContext.req.query("page"),
    honoContext.req.query("pageSize"),
    {
      defaultPageSize: 100,
      maxPageSize: 500,
      maxOffset: 1_000_000,
    }
  );

  if (!paginationResolution.ok) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_PAGINATION",
      message: paginationResolution.message,
    });
  }

  const sortBy = resolveFacilitySortBy(honoContext.req.query("sortBy"));
  if (sortBy === null) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SORT",
      message:
        "sortBy must be one of: facilityName, providerId, stateAbbrev, commissionedSemantic, leaseOrOwn, commissionedPowerMw, plannedPowerMw, underConstructionPowerMw, availablePowerMw, updatedAt",
    });
  }

  const sortOrder = resolveSortDirection(honoContext.req.query("sortOrder"));
  if (sortOrder === null) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SORT",
      message: "sortOrder must be one of: asc, desc",
    });
  }

  return {
    perspective: perspectiveResolution.perspective,
    pagination: paginationResolution.value,
    sortBy,
    sortOrder,
  };
}

export function registerFacilitiesTableRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilitiesTable, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const query = resolveFacilitiesTableQuery(honoContext);

        const queryResult = await queryFacilitiesTable({
          perspective: query.perspective,
          limit: query.pagination.pageSize,
          offset: query.pagination.offset,
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
            page: query.pagination.page,
            pageSize: query.pagination.pageSize,
            totalCount: queryResult.value.totalCount,
            totalPages: totalPages(queryResult.value.totalCount, query.pagination.pageSize),
          },
        };

        return jsonOk(honoContext, FacilitiesTableResponseSchema, payload, requestId);
      })
    )
  );
}
