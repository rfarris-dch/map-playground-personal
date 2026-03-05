import {
  ApiQueryDefaults,
  ApiRoutes,
  type FacilitiesFeatureCollection,
  FacilitiesFeatureCollectionSchema,
  parseBboxParam,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { getFacilitiesBboxMaxRows } from "@/geo/facilities/facilities.repo";
import {
  facilitiesMappingError,
  facilitiesPostgisQueryError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import {
  clampLimit,
  resolvePerspectiveParam,
} from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilitiesByBbox } from "@/geo/facilities/route/facilities-route-query.service";
import { getOrCreateRequestId, jsonError, jsonOk } from "@/http/api-response";

export function registerFacilitiesBboxRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilities, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const bboxRaw = c.req.query("bbox");
    const bbox = bboxRaw ? parseBboxParam(bboxRaw) : null;

    if (bbox === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_BBOX",
        message: "bbox query param required: west,south,east,north",
      });
    }

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
    const maxRows = getFacilitiesBboxMaxRows(perspective);
    const limit = clampLimit(c.req.query("limit"), maxRows, ApiQueryDefaults.facilities.bboxLimit);

    const queryResult = await queryFacilitiesByBbox({
      bbox,
      limit,
      perspective,
    });

    if (!queryResult.ok) {
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

    const payload: FacilitiesFeatureCollection = {
      type: "FeatureCollection",
      features: queryResult.value.features,
      meta: buildFacilitiesRouteMeta({
        requestId,
        recordCount: queryResult.value.features.length,
        truncated: queryResult.value.truncated,
        warnings: queryResult.value.warnings,
      }),
    };

    return jsonOk(c, FacilitiesFeatureCollectionSchema, payload, requestId);
  });
}
