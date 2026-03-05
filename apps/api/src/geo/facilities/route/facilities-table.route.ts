import {
  ApiRoutes,
  type FacilitiesTableResponse,
  FacilitiesTableResponseSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import {
  facilitiesMappingError,
  facilitiesTableQueryError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import {
  resolveFacilitySortBy,
  resolvePerspectiveParam,
  resolveSortDirection,
} from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilitiesTable } from "@/geo/facilities/route/facilities-route-query.service";
import { getOrCreateRequestId, jsonError, jsonOk } from "@/http/api-response";
import { resolvePaginationParams, totalPages } from "@/http/pagination-params.service";

export function registerFacilitiesTableRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilitiesTable, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const perspectiveResolution = resolvePerspectiveParam(c.req.query("perspective"));
    if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_PERSPECTIVE",
        message: perspectiveResolution.error ?? "perspective query param is invalid",
      });
    }

    const perspective = perspectiveResolution.perspective;

    const paginationResolution = resolvePaginationParams(
      c.req.query("page"),
      c.req.query("pageSize"),
      {
        defaultPageSize: 100,
        maxPageSize: 500,
        maxOffset: 1_000_000,
      }
    );

    if (!paginationResolution.ok) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_PAGINATION",
        message: paginationResolution.message,
      });
    }

    const pagination = paginationResolution.value;
    const sortBy = resolveFacilitySortBy(c.req.query("sortBy"));
    if (sortBy === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SORT",
        message:
          "sortBy must be one of: facilityName, providerId, stateAbbrev, commissionedSemantic, leaseOrOwn, commissionedPowerMw, plannedPowerMw, underConstructionPowerMw, availablePowerMw, updatedAt",
      });
    }
    const sortOrder = resolveSortDirection(c.req.query("sortOrder"));
    if (sortOrder === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SORT",
        message: "sortOrder must be one of: asc, desc",
      });
    }

    const queryResult = await queryFacilitiesTable({
      perspective,
      limit: pagination.pageSize,
      offset: pagination.offset,
      sortBy,
      sortOrder,
    });

    if (!queryResult.ok) {
      if (queryResult.value.reason === "query_failed") {
        return facilitiesTableQueryError(c, {
          requestId,
          error: queryResult.value.error,
        });
      }

      return facilitiesMappingError(c, {
        requestId,
        error: queryResult.value.error,
      });
    }

    const payload: FacilitiesTableResponse = {
      rows: [...queryResult.value.rows],
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalCount: queryResult.value.totalCount,
        totalPages: totalPages(queryResult.value.totalCount, pagination.pageSize),
      },
    };

    return jsonOk(c, FacilitiesTableResponseSchema, payload, requestId);
  });
}
