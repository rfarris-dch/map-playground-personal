import {
  ApiRoutes,
  type FacilitiesFeatureCollection,
  FacilitiesSelectionRequestSchema,
  type FacilitiesSelectionResponse,
  FacilitiesSelectionResponseSchema,
  type FacilityPerspective,
  type Warning,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { getFacilitiesPolygonMaxRows } from "@/geo/facilities/facilities.repo";
import {
  facilitiesMappingError,
  facilitiesPostgisQueryError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  facilitiesSelectionBboxExceedsLimits,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/route/facilities-route-policy.service";
import { queryFacilitiesByPolygon } from "@/geo/facilities/route/facilities-route-query.service";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "@/http/api-response";
import { readJsonBody } from "@/http/json-request.service";

function dedupePerspectives(perspectives: readonly FacilityPerspective[]): FacilityPerspective[] {
  return perspectives.reduce<FacilityPerspective[]>((next, perspective) => {
    if (!next.includes(perspective)) {
      next.push(perspective);
    }

    return next;
  }, []);
}

export function registerFacilitiesSelectionRoute<E extends Env>(app: Hono<E>): void {
  app.post(ApiRoutes.facilitiesSelection, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const bodyResult = await readJsonBody(c, {
      requestId,
      invalidJsonMessage: "invalid JSON body",
    });
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const parsedRequest = FacilitiesSelectionRequestSchema.safeParse(bodyResult.value);
    if (!parsedRequest.success) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SELECTION_REQUEST",
        message: "invalid facilities selection request payload",
        details: toDebugDetails(parsedRequest.error),
      });
    }

    const geometry = resolveFacilitiesSelectionGeometry(parsedRequest.data.geometry);
    if (geometry.geometryText.length > FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS) {
      return jsonError(c, {
        requestId,
        httpStatus: 422,
        code: "POLICY_REJECTED",
        message: "selection polygon AOI payload is too large",
      });
    }

    if (facilitiesSelectionBboxExceedsLimits(geometry.bbox)) {
      return jsonError(c, {
        requestId,
        httpStatus: 422,
        code: "POLICY_REJECTED",
        message: "selection polygon AOI exceeds configured bbox limits",
      });
    }

    const perspectives = dedupePerspectives(parsedRequest.data.perspectives);
    const countsByPerspective: Record<FacilityPerspective, number> = {
      colocation: 0,
      hyperscale: 0,
    };
    const truncatedByPerspective: Record<FacilityPerspective, boolean> = {
      colocation: false,
      hyperscale: false,
    };
    const features: FacilitiesFeatureCollection["features"] = [];
    const warnings: Warning[] = [];

    for (const perspective of perspectives) {
      const maxRows = getFacilitiesPolygonMaxRows(perspective);
      const limit = Math.min(parsedRequest.data.limitPerPerspective, maxRows);
      const queryResult = await queryFacilitiesByPolygon({
        geometryGeoJson: geometry.geometryText,
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

      countsByPerspective[perspective] = queryResult.value.features.length;
      truncatedByPerspective[perspective] = queryResult.value.truncated;
      features.push(...queryResult.value.features);
      warnings.push(
        ...queryResult.value.warnings.map((warning) => ({
          code: `${perspective.toUpperCase()}_${warning.code}`,
          message: `[${perspective}] ${warning.message}`,
        }))
      );
    }

    const payload: FacilitiesSelectionResponse = {
      type: "FeatureCollection",
      features,
      meta: buildFacilitiesRouteMeta({
        requestId,
        recordCount: features.length,
        truncated: truncatedByPerspective.colocation || truncatedByPerspective.hyperscale,
        warnings,
      }),
      selection: {
        countsByPerspective,
        truncatedByPerspective,
      },
    };

    return jsonOk(c, FacilitiesSelectionResponseSchema, payload, requestId);
  });
}
