import {
  ApiRoutes,
  type ProviderSortBy,
  ProviderSortBySchema,
  type ProvidersTableResponse,
  ProvidersTableResponseSchema,
  type SortDirection,
  SortDirectionSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { queryProvidersTable } from "@/geo/providers/providers-query.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { resolvePaginationParams, totalPages } from "@/http/pagination-params.service";

interface ProvidersQueryParams {
  readonly pagination: {
    readonly offset: number;
    readonly page: number;
    readonly pageSize: number;
  };
  readonly sortBy: ProviderSortBy;
  readonly sortOrder: SortDirection;
}

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

function resolveProvidersQueryParams(
  page: string | undefined,
  pageSize: string | undefined,
  sortByValue: string | undefined,
  sortOrderValue: string | undefined
): ProvidersQueryParams {
  const paginationResolution = resolvePaginationParams(page, pageSize, {
    defaultPageSize: 100,
    maxPageSize: 500,
    maxOffset: 1_000_000,
  });

  if (!paginationResolution.ok) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_PAGINATION",
      message: paginationResolution.message,
    });
  }

  const sortBy = resolveProviderSortBy(sortByValue);
  if (sortBy === null) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SORT",
      message: "sortBy must be one of: name, category, country, state, listingCount, updatedAt",
    });
  }

  const sortOrder = resolveSortDirection(sortOrderValue);
  if (sortOrder === null) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SORT",
      message: "sortOrder must be one of: asc, desc",
    });
  }

  return {
    pagination: paginationResolution.value,
    sortBy,
    sortOrder,
  };
}

function providerResultError(result: { readonly error: unknown; readonly reason: string }) {
  return routeError({
    httpStatus: result.reason === "query_failed" ? 503 : 500,
    code: result.reason === "query_failed" ? "PROVIDER_QUERY_FAILED" : "PROVIDER_MAPPING_FAILED",
    message: result.reason === "query_failed" ? "provider query failed" : "provider mapping failed",
    details: toDebugDetails(result.error),
  });
}

export function registerProvidersRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.providers, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const queryParams = resolveProvidersQueryParams(
          honoContext.req.query("page"),
          honoContext.req.query("pageSize"),
          honoContext.req.query("sortBy"),
          honoContext.req.query("sortOrder")
        );

        const queryResult = await queryProvidersTable({
          limit: queryParams.pagination.pageSize,
          offset: queryParams.pagination.offset,
          sortBy: queryParams.sortBy,
          sortOrder: queryParams.sortOrder,
        });

        if (!queryResult.ok) {
          throw providerResultError(queryResult.value);
        }

        const payload: ProvidersTableResponse = {
          rows: [...queryResult.value.rows],
          pagination: {
            page: queryParams.pagination.page,
            pageSize: queryParams.pagination.pageSize,
            totalCount: queryResult.value.totalCount,
            totalPages: totalPages(queryResult.value.totalCount, queryParams.pagination.pageSize),
          },
        };

        return jsonOk(honoContext, ProvidersTableResponseSchema, payload, requestId);
      })
    )
  );
}
