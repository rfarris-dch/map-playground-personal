import { ApiHeaders, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesSelectionRequestSchema,
  type FacilitiesSelectionResponse,
  FacilitiesSelectionResponseSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Context, Env, Hono } from "hono";
import { queryFacilitiesSelection } from "@/geo/facilities/facilities-selection.service";
import {
  buildFacilitiesCacheEntry,
  createFacilitiesCacheHeaders,
  resolveFacilitiesCachedEntry,
} from "@/geo/facilities/route/facilities-cache.service";
import type { FacilitiesSelectionCacheBody } from "@/geo/facilities/route/facilities-cache.types";
import {
  buildFacilitiesSelectionCacheKey,
  hashFacilitiesCachePayload,
} from "@/geo/facilities/route/facilities-cache-key.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { jsonOk, toDebugDetails, withHeaders } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

function isStaleEligibleFacilitiesSelectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("httpStatus" in error)) {
    return true;
  }

  const httpStatus = Reflect.get(error, "httpStatus");
  return typeof httpStatus === "number" && httpStatus >= 500;
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

  const runtimeConfig = getApiRuntimeConfig();
  const cacheResult = await resolveFacilitiesCachedEntry<FacilitiesSelectionCacheBody>({
    allowStaleOnError: isStaleEligibleFacilitiesSelectionError,
    key: await buildFacilitiesSelectionCacheKey({
      datasetVersion: runtimeConfig.facilitiesDatasetVersion,
      geometry: requestResult.value.geometry,
      limitPerPerspective: requestResult.value.limitPerPerspective,
      perspectives: requestResult.value.perspectives,
    }),
    buildFreshEntry: async () => {
      const selectionResult = await queryFacilitiesSelection({
        geometry: requestResult.value.geometry,
        limitPerPerspective: requestResult.value.limitPerPerspective,
        perspectives: requestResult.value.perspectives,
      });
      if (!selectionResult.ok) {
        throw toFacilitiesSelectionRouteError(selectionResult.value);
      }

      const payloadBody: FacilitiesSelectionCacheBody = {
        features: selectionResult.value.features,
        selection: {
          countsByPerspective: selectionResult.value.countsByPerspective,
          truncatedByPerspective: selectionResult.value.truncatedByPerspective,
        },
        truncated:
          selectionResult.value.truncatedByPerspective.colocation ||
          selectionResult.value.truncatedByPerspective.hyperscale,
        warnings: [...selectionResult.value.warnings],
      };
      const serializedPayloadBody = JSON.stringify(payloadBody);

      return buildFacilitiesCacheEntry({
        dataVersion: runtimeConfig.dataVersion,
        datasetVersion: runtimeConfig.facilitiesDatasetVersion,
        etag: `"${hashFacilitiesCachePayload(serializedPayloadBody)}"`,
        generatedAt: new Date().toISOString(),
        originRequestId: args.requestId,
        payload: payloadBody,
        payloadBytes: serializedPayloadBody.length,
      });
    },
  });

  const payload: FacilitiesSelectionResponse = {
    type: "FeatureCollection",
    features: cacheResult.entry.payload.features,
    meta: buildFacilitiesRouteMeta({
      dataVersion: cacheResult.entry.dataVersion,
      datasetVersion: cacheResult.entry.datasetVersion,
      generatedAt: cacheResult.entry.generatedAt,
      requestId: args.requestId,
      recordCount: cacheResult.entry.payload.features.length,
      truncated: cacheResult.entry.payload.truncated,
      warnings: cacheResult.entry.payload.warnings,
    }),
    selection: cacheResult.entry.payload.selection,
  };
  const responseHeaders = createFacilitiesCacheHeaders({
    cacheStatus: cacheResult.cacheStatus,
    dataVersion: cacheResult.entry.dataVersion,
    datasetVersion: cacheResult.entry.datasetVersion,
    etag: cacheResult.entry.etag,
    originRequestId: cacheResult.entry.originRequestId,
  });

  return withHeaders(
    jsonOk(args.honoContext, FacilitiesSelectionResponseSchema, payload, args.requestId),
    {
      "Cache-Control": "no-store",
      [ApiHeaders.cacheStatus]: responseHeaders.cacheStatus,
      [ApiHeaders.dataVersion]: responseHeaders.dataVersion,
      [ApiHeaders.datasetVersion]: responseHeaders.datasetVersion,
      [ApiHeaders.originRequestId]: responseHeaders.originRequestId,
      ETag: responseHeaders.etag,
    }
  );
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
