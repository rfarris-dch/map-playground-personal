import {
  ApiRoutes,
  type FacilitiesFeatureCollection,
  FacilitiesSelectionRequestSchema,
  type FacilitiesSelectionResponse,
  FacilitiesSelectionResponseSchema,
  type FacilityPerspective,
  type Warning,
} from "@map-migration/contracts";
import type { Context, Env, Hono } from "hono";
import { getFacilitiesPolygonMaxRows } from "@/geo/facilities/facilities.repo";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  facilitiesSelectionBboxExceedsLimits,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/route/facilities-route-policy.service";
import { queryFacilitiesByPolygon } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";

function dedupePerspectives(perspectives: readonly FacilityPerspective[]): FacilityPerspective[] {
  return perspectives.reduce<FacilityPerspective[]>((next, perspective) => {
    if (!next.includes(perspective)) {
      next.push(perspective);
    }

    return next;
  }, []);
}

async function readFacilitiesSelectionRequest(c: Context, requestId: string) {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsedRequest = FacilitiesSelectionRequestSchema.safeParse(bodyResult.value);
  if (!parsedRequest.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SELECTION_REQUEST",
      message: "invalid facilities selection request payload",
      details: toDebugDetails(parsedRequest.error),
    });
  }

  return {
    ok: true as const,
    value: parsedRequest.data,
  };
}

function assertFacilitiesSelectionGeometryAllowed(geometry: {
  readonly bbox: ReturnType<typeof resolveFacilitiesSelectionGeometry>["bbox"];
  readonly geometryText: string;
}): void {
  if (facilitiesSelectionBboxExceedsLimits(geometry.bbox)) {
    throw routeError({
      httpStatus: 422,
      code: "POLICY_REJECTED",
      message: "selection polygon AOI exceeds the facilities selection extent limit",
    });
  }

  if (geometry.geometryText.length > FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS) {
    throw routeError({
      httpStatus: 422,
      code: "POLICY_REJECTED",
      message: "selection polygon AOI payload is too large",
    });
  }
}

async function queryFacilitiesSelectionPerspectives(args: {
  readonly geometryText: string;
  readonly limitPerPerspective: number;
  readonly perspectives: readonly FacilityPerspective[];
}): Promise<{
  readonly countsByPerspective: Record<FacilityPerspective, number>;
  readonly features: FacilitiesFeatureCollection["features"];
  readonly truncatedByPerspective: Record<FacilityPerspective, boolean>;
  readonly warnings: Warning[];
}> {
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

  for (const perspective of args.perspectives) {
    const maxRows = getFacilitiesPolygonMaxRows(perspective);
    const limit = Math.min(args.limitPerPerspective, maxRows);
    const queryResult = await queryFacilitiesByPolygon({
      geometryGeoJson: args.geometryText,
      limit,
      perspective,
    });

    if (!queryResult.ok) {
      throw queryResult.value.reason === "query_failed"
        ? buildFacilitiesPostgisQueryRouteError(queryResult.value.error)
        : buildFacilitiesMappingRouteError(queryResult.value.error);
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

  return {
    countsByPerspective,
    features,
    truncatedByPerspective,
    warnings,
  };
}

async function normalizeFacilitiesSelectionGeometry(geometryText: string): Promise<{
  readonly geometryText: string;
  readonly warnings: Warning[];
}> {
  try {
    const normalizedGeometry = await normalizePolygonGeometryGeoJson(geometryText);
    return {
      geometryText: normalizedGeometry.geometryText,
      warnings: normalizedGeometry.wasRepaired
        ? [buildPolygonRepairWarning("selection", normalizedGeometry.invalidReason)]
        : [],
    };
  } catch (error) {
    throw routeError({
      httpStatus: 422,
      code: "POLICY_REJECTED",
      message:
        error instanceof Error
          ? `selection polygon is invalid after repair: ${error.message}`
          : "selection polygon is invalid after repair",
    });
  }
}

export function registerFacilitiesSelectionRoute<E extends Env>(app: Hono<E>): void {
  app.post(ApiRoutes.facilitiesSelection, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const requestResult = await readFacilitiesSelectionRequest(honoContext, requestId);
        if (!requestResult.ok) {
          return requestResult.response;
        }

        const geometry = resolveFacilitiesSelectionGeometry(requestResult.value.geometry);
        assertFacilitiesSelectionGeometryAllowed(geometry);
        const normalizedGeometry = await normalizeFacilitiesSelectionGeometry(
          geometry.geometryText
        );

        const perspectives = dedupePerspectives(requestResult.value.perspectives);
        const { countsByPerspective, features, truncatedByPerspective, warnings } =
          await queryFacilitiesSelectionPerspectives({
            geometryText: normalizedGeometry.geometryText,
            limitPerPerspective: requestResult.value.limitPerPerspective,
            perspectives,
          });

        const payload: FacilitiesSelectionResponse = {
          type: "FeatureCollection",
          features,
          meta: buildFacilitiesRouteMeta({
            requestId,
            recordCount: features.length,
            truncated: truncatedByPerspective.colocation || truncatedByPerspective.hyperscale,
            warnings: [...normalizedGeometry.warnings, ...warnings],
          }),
          selection: {
            countsByPerspective,
            truncatedByPerspective,
          },
        };

        return jsonOk(honoContext, FacilitiesSelectionResponseSchema, payload, requestId);
      })
    )
  );
}
