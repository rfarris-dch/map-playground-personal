import {
  ApiRoutes,
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import {
  facilitiesMappingError,
  facilitiesPostgisQueryError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { resolvePerspectiveParam } from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilityDetail } from "@/geo/facilities/route/facilities-route-query.service";
import { getOrCreateRequestId, jsonError, jsonOk } from "@/http/api-response";

export function registerFacilitiesDetailRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.facilities}/:facility-id`, async (c) => {
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

    const facilityId = c.req.param("facility-id").trim();
    if (facilityId.length === 0) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_FACILITY_ID",
        message: "facility-id path param is required",
      });
    }

    const queryResult = await queryFacilityDetail({
      facilityId,
      perspective,
    });

    if (!queryResult.ok) {
      if (queryResult.value.reason === "not_found") {
        return jsonError(c, {
          requestId,
          httpStatus: 404,
          code: "FACILITY_NOT_FOUND",
          message: "facility not found",
        });
      }

      if (queryResult.value.reason === "query_failed") {
        return facilitiesPostgisQueryError(c, {
          requestId,
          error: queryResult.value.error,
        });
      }

      return facilitiesMappingError(c, {
        requestId,
        error: queryResult.value.error,
      });
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

    return jsonOk(c, FacilitiesDetailResponseSchema, payload, requestId);
  });
}
