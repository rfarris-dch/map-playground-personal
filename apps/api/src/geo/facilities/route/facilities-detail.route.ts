import {
  ApiRoutes,
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { resolvePerspectiveParam } from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilityDetail } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

export function registerFacilitiesDetailRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.facilities}/:facility-id`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const perspectiveResolution = resolvePerspectiveParam(honoContext.req.query("perspective"));
        if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_PERSPECTIVE",
            message: perspectiveResolution.error ?? "perspective query param is invalid",
          });
        }

        const facilityId = honoContext.req.param("facility-id").trim();
        if (facilityId.length === 0) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_FACILITY_ID",
            message: "facility-id path param is required",
          });
        }

        const queryResult = await queryFacilityDetail({
          facilityId,
          perspective: perspectiveResolution.perspective,
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
