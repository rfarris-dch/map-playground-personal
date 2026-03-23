import { ApiHeaders, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type FacilitiesTableRequest,
  FacilitiesTableRequestSchema,
  type FacilitiesTableResponse,
  FacilitiesTableResponseSchema,
} from "@map-migration/http-contracts/table-contracts";
import type { Context, Env, Hono } from "hono";
import {
  buildFacilitiesCacheEntry,
  createFacilitiesCacheHeaders,
  getFacilitiesProtectedCacheVary,
  getFacilitiesSharedCacheControl,
  resolveFacilitiesCachedEntry,
} from "@/geo/facilities/route/facilities-cache.service";
import type { FacilitiesTableCacheBody } from "@/geo/facilities/route/facilities-cache.types";
import {
  buildFacilitiesTableCacheKey,
  hashFacilitiesCachePayload,
} from "@/geo/facilities/route/facilities-cache-key.service";
import {
  bindFacilitiesDatasetVersion,
  readRequestedFacilitiesDatasetVersionForCacheableGet,
} from "@/geo/facilities/route/facilities-dataset-version.service";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesTableQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { queryFacilitiesTable } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails, withHeaders } from "@/http/api-response";
import { matchesIfNoneMatch } from "@/http/conditional-request.service";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { totalPages } from "@/http/pagination-params.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

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
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const query = resolveFacilitiesTableQuery(honoContext);
        const runtimeConfig = getApiRuntimeConfig();
        const versionBinding = await bindFacilitiesDatasetVersion(
          readRequestedFacilitiesDatasetVersionForCacheableGet({
            headerValue: honoContext.req.header(ApiHeaders.datasetVersion),
            queryValue: honoContext.req.query("v") ?? honoContext.req.query("datasetVersion"),
          }),
          signal
        );
        const offset = query.page * query.pageSize;
        const cacheResult = await resolveFacilitiesCachedEntry<FacilitiesTableCacheBody>({
          allowStaleOnError: () => true,
          key: buildFacilitiesTableCacheKey({
            datasetVersion: versionBinding.actualDatasetVersion,
            page: query.page,
            pageSize: query.pageSize,
            perspective: query.perspective,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          }),
          buildFreshEntry: async () => {
            const queryResult = await queryFacilitiesTable({
              perspective: query.perspective,
              limit: query.pageSize,
              offset,
              sortBy: query.sortBy,
              sortOrder: query.sortOrder,
              tables: versionBinding.tables,
            });

            if (!queryResult.ok) {
              throw queryResult.value.reason === "query_failed"
                ? buildFacilitiesTableQueryRouteError(queryResult.value.error)
                : buildFacilitiesMappingRouteError(queryResult.value.error);
            }

            const payloadBody: FacilitiesTableCacheBody = {
              rows: [...queryResult.value.rows],
              totalCount: queryResult.value.totalCount,
            };
            const serializedPayloadBody = JSON.stringify(payloadBody);
            return buildFacilitiesCacheEntry({
              dataVersion: runtimeConfig.dataVersion,
              datasetVersion: versionBinding.actualDatasetVersion,
              etag: `"${hashFacilitiesCachePayload(serializedPayloadBody)}"`,
              generatedAt: new Date().toISOString(),
              originRequestId: requestId,
              payload: payloadBody,
              payloadBytes: serializedPayloadBody.length,
            });
          },
        });

        const payload: FacilitiesTableResponse = {
          rows: [...cacheResult.entry.payload.rows],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            totalCount: cacheResult.entry.payload.totalCount,
            totalPages: totalPages(cacheResult.entry.payload.totalCount, query.pageSize),
          },
        };
        const responseHeaders = createFacilitiesCacheHeaders({
          cacheStatus: cacheResult.cacheStatus,
          dataVersion: cacheResult.entry.dataVersion,
          datasetVersion: cacheResult.entry.datasetVersion,
          etag: cacheResult.entry.etag,
          originRequestId: cacheResult.entry.originRequestId,
        });
        if (
          matchesIfNoneMatch({
            etag: responseHeaders.etag,
            ifNoneMatchHeader: honoContext.req.header("if-none-match"),
          })
        ) {
          return new Response(null, {
            status: 304,
            headers: {
              "Cache-Control": getFacilitiesSharedCacheControl(),
              [ApiHeaders.cacheStatus]: responseHeaders.cacheStatus,
              [ApiHeaders.dataVersion]: responseHeaders.dataVersion,
              [ApiHeaders.datasetVersion]: responseHeaders.datasetVersion,
              [ApiHeaders.originRequestId]: responseHeaders.originRequestId,
              [ApiHeaders.requestId]: requestId,
              ETag: responseHeaders.etag,
              Vary: getFacilitiesProtectedCacheVary(),
            },
          });
        }

        return withHeaders(jsonOk(honoContext, FacilitiesTableResponseSchema, payload, requestId), {
          "Cache-Control": getFacilitiesSharedCacheControl(),
          [ApiHeaders.cacheStatus]: responseHeaders.cacheStatus,
          [ApiHeaders.dataVersion]: responseHeaders.dataVersion,
          [ApiHeaders.datasetVersion]: responseHeaders.datasetVersion,
          [ApiHeaders.originRequestId]: responseHeaders.originRequestId,
          ETag: responseHeaders.etag,
          Vary: getFacilitiesProtectedCacheVary(),
        });
      })
    )
  );
}
