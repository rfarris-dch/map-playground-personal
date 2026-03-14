import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesSelectionRequestSchema,
  type FacilitiesSelectionResponse,
  FacilitiesSelectionResponseSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Context, Env, Hono } from "hono";
import { queryFacilitiesSelection } from "@/geo/facilities/facilities-selection.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";

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

function toFacilitiesSelectionRouteError(error: {
  readonly error: unknown;
  readonly message: string;
  readonly reason: "mapping_failed" | "policy_rejected" | "query_failed";
}) {
  if (error.reason === "mapping_failed") {
    return routeError({
      httpStatus: 500,
      code: "FACILITY_MAPPING_FAILED",
      message: error.message,
      details: toDebugDetails(error.error),
    });
  }

  if (error.reason === "query_failed") {
    return routeError({
      httpStatus: 503,
      code: "POSTGIS_QUERY_FAILED",
      message: error.message,
      details: toDebugDetails(error.error),
    });
  }

  return routeError({
    httpStatus: 422,
    code: "POLICY_REJECTED",
    message: error.message,
  });
}

async function handleFacilitiesSelectionRequest(args: {
  readonly honoContext: Context;
  readonly requestId: string;
}) {
  const requestResult = await readFacilitiesSelectionRequest(args.honoContext, args.requestId);
  if (!requestResult.ok) {
    return requestResult.response;
  }

  const selectionResult = await queryFacilitiesSelection({
    geometry: requestResult.value.geometry,
    limitPerPerspective: requestResult.value.limitPerPerspective,
    perspectives: requestResult.value.perspectives,
  });
  if (!selectionResult.ok) {
    throw toFacilitiesSelectionRouteError(selectionResult.value);
  }

  const payload: FacilitiesSelectionResponse = {
    type: "FeatureCollection",
    features: selectionResult.value.features,
    meta: buildFacilitiesRouteMeta({
      requestId: args.requestId,
      recordCount: selectionResult.value.features.length,
      truncated:
        selectionResult.value.truncatedByPerspective.colocation ||
        selectionResult.value.truncatedByPerspective.hyperscale,
      warnings: selectionResult.value.warnings,
    }),
    selection: {
      countsByPerspective: selectionResult.value.countsByPerspective,
      truncatedByPerspective: selectionResult.value.truncatedByPerspective,
    },
  };

  return jsonOk(args.honoContext, FacilitiesSelectionResponseSchema, payload, args.requestId);
}

export function registerFacilitiesSelectionRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(ApiRoutes.facilitiesSelection, "selection");

  app.post(ApiRoutes.facilitiesSelection, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) =>
        handleFacilitiesSelectionRequest({ honoContext, requestId })
      )
    )
  );
}
