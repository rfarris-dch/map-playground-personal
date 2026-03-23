import { ApiHeaders, ApiQueryDefaults, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesBboxRequestSchema,
  type FacilitiesFeatureCollection,
  FacilitiesFeatureCollectionSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Env, Hono } from "hono";
import { getFacilitiesBboxMaxRows } from "@/geo/facilities/facilities.repo";
import {
  buildFacilitiesCacheEntry,
  createFacilitiesCacheHeaders,
  getFacilitiesSharedCacheControl,
  resolveFacilitiesCachedEntry,
} from "@/geo/facilities/route/facilities-cache.service";
import type { FacilitiesBboxCacheBody } from "@/geo/facilities/route/facilities-cache.types";
import {
  buildFacilitiesBboxCacheKey,
  hashFacilitiesCachePayload,
} from "@/geo/facilities/route/facilities-cache-key.service";
import { recordFacilitiesBboxMetrics } from "@/geo/facilities/route/facilities-performance.service";
import {
  buildFacilitiesMappingRouteError,
  buildFacilitiesPostgisQueryRouteError,
} from "@/geo/facilities/route/facilities-route-errors.service";
import { buildFacilitiesRouteMeta } from "@/geo/facilities/route/facilities-route-meta.service";
import { clampLimit } from "@/geo/facilities/route/facilities-route-param.service";
import { queryFacilitiesByBbox } from "@/geo/facilities/route/facilities-route-query.service";
import { jsonOk, toDebugDetails, withHeaders } from "@/http/api-response";
import { matchesIfNoneMatch } from "@/http/conditional-request.service";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

export function registerFacilitiesBboxRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(ApiRoutes.facilities, "facilities");

  app.get(ApiRoutes.facilities, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const routeStartedAt = globalThis.performance.now();
        const request = FacilitiesBboxRequestSchema.safeParse({
          bbox: honoContext.req.query("bbox"),
          datasetVersion: honoContext.req.query("v") ?? honoContext.req.query("datasetVersion"),
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
        const canonicalBboxKey = [
          request.data.bbox.west,
          request.data.bbox.south,
          request.data.bbox.east,
          request.data.bbox.north,
        ].join(",");
        const runtimeConfig = getApiRuntimeConfig();
        const effectiveDatasetVersion =
          request.data.datasetVersion ?? runtimeConfig.facilitiesDatasetVersion;
        let freshMappingTimeMs = 0;
        let freshSqlTimeMs = 0;
        const cacheResult = await resolveFacilitiesCachedEntry<FacilitiesBboxCacheBody>({
          allowStaleOnError: () => true,
          key: buildFacilitiesBboxCacheKey({
            bbox: request.data.bbox,
            datasetVersion: effectiveDatasetVersion,
            limit,
            perspective,
          }),
          buildFreshEntry: async () => {
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

            freshMappingTimeMs = queryResult.value.timing.mappingTimeMs;
            freshSqlTimeMs = queryResult.value.timing.sqlTimeMs;
            const payloadBody: FacilitiesBboxCacheBody = {
              features: queryResult.value.features,
              truncated: queryResult.value.truncated,
              warnings: [...queryResult.value.warnings],
            };
            const serializedPayloadBody = JSON.stringify(payloadBody);
            return buildFacilitiesCacheEntry({
              dataVersion: runtimeConfig.dataVersion,
              datasetVersion: effectiveDatasetVersion,
              etag: `"${hashFacilitiesCachePayload(serializedPayloadBody)}"`,
              generatedAt: new Date().toISOString(),
              originRequestId: requestId,
              payload: payloadBody,
              payloadBytes: serializedPayloadBody.length,
            });
          },
        }).catch((error) => {
          recordFacilitiesBboxMetrics({
            canonicalBboxKey,
            effectiveLimit: limit,
            mappingTimeMs: 0,
            outcome: signal.aborted ? "aborted" : "failed",
            perspective,
            responseBytes: 0,
            routeLatencyMs: globalThis.performance.now() - routeStartedAt,
            rowCount: 0,
            sqlTimeMs: 0,
            truncated: false,
          });
          throw error;
        });

        const payload: FacilitiesFeatureCollection = {
          type: "FeatureCollection",
          features: cacheResult.entry.payload.features,
          meta: buildFacilitiesRouteMeta({
            dataVersion: cacheResult.entry.dataVersion,
            datasetVersion: cacheResult.entry.datasetVersion,
            generatedAt: cacheResult.entry.generatedAt,
            requestId,
            recordCount: cacheResult.entry.payload.features.length,
            truncated: cacheResult.entry.payload.truncated,
            warnings: cacheResult.entry.payload.warnings,
          }),
        };
        const responseHeaders = createFacilitiesCacheHeaders({
          cacheStatus: cacheResult.cacheStatus,
          dataVersion: cacheResult.entry.dataVersion,
          datasetVersion: cacheResult.entry.datasetVersion,
          etag: cacheResult.entry.etag,
          originRequestId: cacheResult.entry.originRequestId,
        });
        const ifNoneMatchHeader = honoContext.req.header("if-none-match");
        if (
          matchesIfNoneMatch({
            etag: responseHeaders.etag,
            ifNoneMatchHeader,
          })
        ) {
          return new Response(null, {
            status: 304,
            headers: {
              "Cache-Control": getFacilitiesSharedCacheControl(),
              [ApiHeaders.cacheStatus]: responseHeaders.cacheStatus,
              [ApiHeaders.dataVersion]: responseHeaders.dataVersion,
              [ApiHeaders.datasetVersion]: responseHeaders.datasetVersion,
              [ApiHeaders.originRequestId]: responseHeaders.originRequestId,
              [ApiHeaders.requestId]: requestId,
              ETag: responseHeaders.etag,
            },
          });
        }
        recordFacilitiesBboxMetrics({
          canonicalBboxKey,
          effectiveLimit: limit,
          mappingTimeMs: cacheResult.cacheStatus === "miss" ? freshMappingTimeMs : 0,
          outcome: "completed",
          perspective,
          responseBytes: cacheResult.entry.payloadBytes,
          routeLatencyMs: globalThis.performance.now() - routeStartedAt,
          rowCount: cacheResult.entry.payload.features.length,
          sqlTimeMs: cacheResult.cacheStatus === "miss" ? freshSqlTimeMs : 0,
          truncated: cacheResult.entry.payload.truncated,
        });

        return withHeaders(
          jsonOk(honoContext, FacilitiesFeatureCollectionSchema, payload, requestId),
          {
            "Cache-Control": getFacilitiesSharedCacheControl(),
            [ApiHeaders.cacheStatus]: responseHeaders.cacheStatus,
            [ApiHeaders.dataVersion]: responseHeaders.dataVersion,
            [ApiHeaders.datasetVersion]: responseHeaders.datasetVersion,
            [ApiHeaders.originRequestId]: responseHeaders.originRequestId,
            ETag: responseHeaders.etag,
          }
        );
      })
    )
  );
}
