import {
  ApiRoutes,
  type ProviderSortBy,
  ProviderSortBySchema,
  type ProvidersTableResponse,
  ProvidersTableResponseSchema,
  type SortDirection,
  SortDirectionSchema,
} from "@map-migration/contracts";
import type { Hono } from "hono";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "../../http/api-response";
import { resolvePaginationParams, totalPages } from "../../http/pagination-params.service";
import { queryProvidersTable } from "./providers-query.service";

function resolveProviderSortBy(value: string | undefined): ProviderSortBy | null {
  if (typeof value === "undefined") {
    return "name";
  }

  const parsed = ProviderSortBySchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function resolveSortDirection(value: string | undefined): SortDirection | null {
  if (typeof value === "undefined") {
    return "asc";
  }

  const parsed = SortDirectionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function registerProvidersRoute(app: Hono): void {
  app.get(ApiRoutes.providers, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const paginationResolution = resolvePaginationParams(
      c.req.query("page"),
      c.req.query("pageSize"),
      {
        defaultPageSize: 100,
        maxPageSize: 500,
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
    const sortBy = resolveProviderSortBy(c.req.query("sortBy"));
    if (sortBy === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SORT",
        message: "sortBy must be one of: name, category, country, state, listingCount, updatedAt",
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

    const queryResult = await queryProvidersTable({
      limit: pagination.pageSize,
      offset: pagination.offset,
      sortBy,
      sortOrder,
    });

    if (!queryResult.ok) {
      if (queryResult.value.reason === "query_failed") {
        return jsonError(c, {
          requestId,
          httpStatus: 503,
          code: "PROVIDER_QUERY_FAILED",
          message: "provider query failed",
          details: toDebugDetails(queryResult.value.error),
        });
      }

      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "PROVIDER_MAPPING_FAILED",
        message: "provider mapping failed",
        details: toDebugDetails(queryResult.value.error),
      });
    }

    const payload: ProvidersTableResponse = {
      rows: [...queryResult.value.rows],
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalCount: queryResult.value.totalCount,
        totalPages: totalPages(queryResult.value.totalCount, pagination.pageSize),
      },
    };

    return jsonOk(c, ProvidersTableResponseSchema, payload, requestId);
  });
}
