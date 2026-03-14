import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesDetailRequestSchema,
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
  FacilityDetailPathSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Env, Hono } from "hono";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { queryFacilityDetail } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

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

        const payload: FacilitiesDetailResponse = {
          feature: queryResult.value.feature,
          meta: buildFacilitiesRouteMeta({
            requestId,
            recordCount: 1,
            truncated: false,
            warnings: [],
          }),
        };

        return jsonOk(honoContext, FacilitiesDetailResponseSchema, payload, requestId);
      })
    )
  );
}
