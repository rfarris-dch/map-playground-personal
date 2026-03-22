import { ApiHeaders, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesDetailRequestSchema,
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
  FacilityDetailPathSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Env, Hono } from "hono";
import {
  buildFacilitiesCacheEntry,
  createFacilitiesCacheHeaders,
  resolveFacilitiesCachedEntry,
} from "@/geo/facilities/route/facilities-cache.service";
import type { FacilitiesDetailCacheBody } from "@/geo/facilities/route/facilities-cache.types";
import {
  buildFacilitiesDetailCacheKey,
  hashFacilitiesCachePayload,
} from "@/geo/facilities/route/facilities-cache-key.service";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { queryFacilityDetail } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails, withHeaders } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { getApiRuntimeConfig } from "@/http/runtime-config";

function isStaleEligibleFacilitiesDetailError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("httpStatus" in error)) {
    return true;
  }

  const httpStatus = Reflect.get(error, "httpStatus");
  return typeof httpStatus === "number" && httpStatus >= 500;
}

export function registerFacilitiesDetailRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.facilities}/:facility-id`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = FacilitiesDetailRequestSchema.safeParse({
          perspective: honoContext.req.query("perspective"),
        });
        if (!request.success) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_FACILITY_DETAIL_REQUEST",
            message: "invalid facility detail request",
            details: toDebugDetails(request.error),
          });
        }

        const path = FacilityDetailPathSchema.safeParse({
          facilityId: honoContext.req.param("facility-id"),
        });
        if (!path.success) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_FACILITY_ID",
            message: "invalid facility-id path param",
            details: toDebugDetails(path.error),
          });
        }

        const runtimeConfig = getApiRuntimeConfig();
        const cacheResult = await resolveFacilitiesCachedEntry<FacilitiesDetailCacheBody>({
          allowStaleOnError: isStaleEligibleFacilitiesDetailError,
          key: buildFacilitiesDetailCacheKey({
            dataVersion: runtimeConfig.dataVersion,
            facilityId: path.data.facilityId,
            perspective: request.data.perspective,
          }),
          buildFreshEntry: async () => {
            const queryResult = await queryFacilityDetail({
              facilityId: path.data.facilityId,
              perspective: request.data.perspective,
            });

            if (!queryResult.ok) {
              if (queryResult.value.reason === "not_found") {
                throw routeError({
                  httpStatus: 404,
                  code: "FACILITY_NOT_FOUND",
                  message: "facility not found",
                });
              }

              throw queryResult.value.reason === "query_failed"
                ? buildFacilitiesPostgisQueryRouteError(queryResult.value.error)
                : buildFacilitiesMappingRouteError(queryResult.value.error);
            }

            const payloadBody: FacilitiesDetailCacheBody = {
              feature: queryResult.value.feature,
            };
            return buildFacilitiesCacheEntry({
              dataVersion: runtimeConfig.dataVersion,
              etag: `"${hashFacilitiesCachePayload(JSON.stringify(payloadBody))}"`,
              generatedAt: new Date().toISOString(),
              originRequestId: requestId,
              payload: payloadBody,
            });
          },
        });

        const payload: FacilitiesDetailResponse = {
          feature: cacheResult.entry.payload.feature,
          meta: buildFacilitiesRouteMeta({
            dataVersion: cacheResult.entry.dataVersion,
            generatedAt: cacheResult.entry.generatedAt,
            requestId,
            recordCount: 1,
            truncated: false,
            warnings: [],
          }),
        };
        const responseHeaders = createFacilitiesCacheHeaders({
          cacheStatus: cacheResult.cacheStatus,
          dataVersion: cacheResult.entry.dataVersion,
          etag: cacheResult.entry.etag,
          originRequestId: cacheResult.entry.originRequestId,
        });

        return withHeaders(
          jsonOk(honoContext, FacilitiesDetailResponseSchema, payload, requestId),
          {
            [ApiHeaders.cacheStatus]: responseHeaders.cacheStatus,
            [ApiHeaders.dataVersion]: responseHeaders.dataVersion,
            [ApiHeaders.originRequestId]: responseHeaders.originRequestId,
            ETag: responseHeaders.etag,
          }
        );
      })
    )
  );
}
