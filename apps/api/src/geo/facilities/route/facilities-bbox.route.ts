import { ApiQueryDefaults, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesBboxRequestSchema,
  type FacilitiesFeatureCollection,
  FacilitiesFeatureCollectionSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Env, Hono } from "hono";
import { getFacilitiesBboxMaxRows } from "@/geo/facilities/facilities.repo";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { clampLimit } from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilitiesByBbox } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";

export function registerFacilitiesBboxRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilities, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = FacilitiesBboxRequestSchema.safeParse({
          bbox: honoContext.req.query("bbox"),
          limit: honoContext.req.query("limit"),
          perspective: honoContext.req.query("perspective"),
        });
        if (!request.success) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_FACILITIES_BBOX_REQUEST",
            message: "invalid facilities bbox request",
            details: toDebugDetails(request.error),
          });
        }

        const perspective = request.data.perspective;
        const maxRows = getFacilitiesBboxMaxRows(perspective);
        const limit = clampLimit(
          String(request.data.limit),
          maxRows,
          ApiQueryDefaults.facilities.bboxLimit
        );

        const queryResult = await queryFacilitiesByBbox({
          bbox: request.data.bbox,
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
