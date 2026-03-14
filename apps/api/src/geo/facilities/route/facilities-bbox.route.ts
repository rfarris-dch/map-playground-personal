import { parseBboxParam } from "@map-migration/geo-kernel/geometry";
import { ApiQueryDefaults, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import { type FacilitiesFeatureCollection, FacilitiesFeatureCollectionSchema } from "@map-migration/http-contracts/facilities-http";
import type { Env, Hono } from "hono";
import { getFacilitiesBboxMaxRows } from "@/geo/facilities/facilities.repo";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import {
  clampLimit,
  resolvePerspectiveParam,
} from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilitiesByBbox } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

export function registerFacilitiesBboxRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilities, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const bboxRaw = honoContext.req.query("bbox");
        const bbox = bboxRaw ? parseBboxParam(bboxRaw) : null;

        if (bbox === null) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_BBOX",
            message: "bbox query param required: west,south,east,north",
          });
        }

        const perspectiveResolution = resolvePerspectiveParam(honoContext.req.query("perspective"));
        if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_PERSPECTIVE",
            message: perspectiveResolution.error ?? "perspective query param is invalid",
          });
        }

        const perspective = perspectiveResolution.perspective;
        const maxRows = getFacilitiesBboxMaxRows(perspective);
        const limit = clampLimit(
          honoContext.req.query("limit"),
          maxRows,
          ApiQueryDefaults.facilities.bboxLimit
        );

        const queryResult = await queryFacilitiesByBbox({
          bbox,
          limit,
          perspective,
        });

        if (!queryResult.ok) {
          throw queryResult.value.reason === "query_failed"
            ? buildFacilitiesPostgisQueryRouteError(queryResult.value.error)
            : buildFacilitiesMappingRouteError(queryResult.value.error);
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

        return jsonOk(honoContext, FacilitiesFeatureCollectionSchema, payload, requestId);
      })
    )
  );
}
