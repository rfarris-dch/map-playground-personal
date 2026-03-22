import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type ProvidersTableRequest,
  ProvidersTableRequestSchema,
  type ProvidersTableResponse,
  ProvidersTableResponseSchema,
} from "@map-migration/http-contracts/table-contracts";
import type { Env, Hono } from "hono";
import { queryProvidersTable } from "@/geo/providers/providers-query.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { totalPages } from "@/http/pagination-params.service";
import { setCacheControlHeader } from "@/http/response-meta.service";
import { getDatasetCacheTtlSeconds } from "@/http/spatial-analysis-policy.service";

function resolveProvidersQueryParams(
  page: string | undefined,
  pageSize: string | undefined,
  sortByValue: string | undefined,
  sortOrderValue: string | undefined
): ProvidersTableRequest {
  const request = ProvidersTableRequestSchema.safeParse({
    page,
    pageSize,
    sortBy: sortByValue,
    sortOrder: sortOrderValue,
  });
  if (!request.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_PROVIDERS_TABLE_REQUEST",
      message: "invalid providers table request",
      details: toDebugDetails(request.error),
    });
  }

  return request.data;
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
        const offset = queryParams.page * queryParams.pageSize;

        const queryResult = await queryProvidersTable({
          limit: queryParams.pageSize,
          offset,
          sortBy: queryParams.sortBy,
          sortOrder: queryParams.sortOrder,
        });

        if (!queryResult.ok) {
          throw providerResultError(queryResult.value);
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("facilities"));

        const payload: ProvidersTableResponse = {
          rows: [...queryResult.value.rows],
          pagination: {
            page: queryParams.page,
            pageSize: queryParams.pageSize,
            totalCount: queryResult.value.totalCount,
            totalPages: totalPages(queryResult.value.totalCount, queryParams.pageSize),
          },
        };

        return jsonOk(honoContext, ProvidersTableResponseSchema, payload, requestId);
      })
    )
  );
}
