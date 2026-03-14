import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type CountyScoresRequest,
  CountyScoresRequestSchema,
  type CountyScoresResponse,
  CountyScoresResponseSchema,
  type CountyScoresStatusResponse,
  CountyScoresStatusResponseSchema,
} from "@map-migration/http-contracts/county-intelligence-http";
import type { Env, Hono } from "hono";
import {
  queryCountyScores,
  queryCountyScoresStatus,
} from "@/geo/county-intelligence/county-intelligence.service";
import {
  buildCountyScoresMappingRouteError,
  buildCountyScoresQueryRouteError,
  buildCountyScoresSourceUnavailableRouteError,
  buildCountyScoresStatusMappingRouteError,
  buildCountyScoresStatusQueryRouteError,
  buildCountyScoresStatusSourceUnavailableRouteError,
} from "@/geo/county-intelligence/county-intelligence-route-errors.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { buildResponseMeta, setCacheControlHeader } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import {
  getDatasetCacheTtlSeconds,
  isDatasetQueryAllowed,
} from "@/http/spatial-analysis-policy.service";

const COUNTY_SCORES_UNPUBLISHED_META_VERSION = "unpublished";

function buildCountyScoresResponseMeta(args: {
  readonly dataVersion?: string | null | undefined;
  readonly recordCount: number;
  readonly requestId: string;
}) {
  const runtimeConfig = getApiRuntimeConfig();
  return buildResponseMeta({
    dataVersion: args.dataVersion ?? COUNTY_SCORES_UNPUBLISHED_META_VERSION,
    recordCount: args.recordCount,
    requestId: args.requestId,
    sourceMode: runtimeConfig.countyIntelligenceSourceMode,
  });
}

function readCountyScoresRequest(countyIdsRaw: string | undefined): CountyScoresRequest {
  const parsed = CountyScoresRequestSchema.safeParse({
    countyIds: countyIdsRaw,
  });
  if (!parsed.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_COUNTY_IDS",
      message: "invalid county scores request",
      details: toDebugDetails(parsed.error),
    });
  }

  return parsed.data;
}

function countyScoresStatusRouteError(reason: string, error: unknown) {
  if (reason === "source_unavailable") {
    return buildCountyScoresStatusSourceUnavailableRouteError(error);
  }

  if (reason === "query_failed") {
    return buildCountyScoresStatusQueryRouteError(error);
  }

  return buildCountyScoresStatusMappingRouteError(error);
}

function countyScoresRouteError(reason: string, error: unknown) {
  if (reason === "source_unavailable") {
    return buildCountyScoresSourceUnavailableRouteError(error);
  }

  if (reason === "query_failed") {
    return buildCountyScoresQueryRouteError(error);
  }

  return buildCountyScoresMappingRouteError(error);
}

export function registerCountyIntelligenceRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.countyScoresStatus, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const countyScoresStatusResult = await queryCountyScoresStatus();

        if (!countyScoresStatusResult.ok) {
          throw countyScoresStatusRouteError(
            countyScoresStatusResult.value.reason,
            countyScoresStatusResult.value.error
          );
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("county_scores"));

        const payload: CountyScoresStatusResponse = {
          ...countyScoresStatusResult.value,
          meta: buildCountyScoresResponseMeta({
            dataVersion: countyScoresStatusResult.value.dataVersion,
            requestId,
            recordCount: 1,
          }),
        };

        return jsonOk(honoContext, CountyScoresStatusResponseSchema, payload, requestId);
      })
    )
  );

  app.get(ApiRoutes.countyScores, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        if (!isDatasetQueryAllowed("county_scores", "county")) {
          throw routeError({
            httpStatus: 422,
            code: "POLICY_REJECTED",
            message: 'query granularity "county" is not allowed for county_scores',
          });
        }

        const request = readCountyScoresRequest(honoContext.req.query("countyIds"));

        const countyScoresResult = await queryCountyScores({
          countyIds: request.countyIds,
        });

        if (!countyScoresResult.ok) {
          throw countyScoresRouteError(
            countyScoresResult.value.reason,
            countyScoresResult.value.error
          );
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("county_scores"));

        const payload: CountyScoresResponse = {
          rows: [...countyScoresResult.value.rows],
          summary: {
            blockedCountyIds: [...countyScoresResult.value.blockedCountyIds],
            deferredCountyIds: [...countyScoresResult.value.deferredCountyIds],
            requestedCountyIds: [...countyScoresResult.value.requestedCountyIds],
            missingCountyIds: [...countyScoresResult.value.missingCountyIds],
          },
          meta: buildCountyScoresResponseMeta({
            dataVersion: countyScoresResult.value.dataVersion,
            requestId,
            recordCount: countyScoresResult.value.rows.length,
          }),
        };

        return jsonOk(honoContext, CountyScoresResponseSchema, payload, requestId);
      })
    )
  );
}
