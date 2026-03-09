import {
  ApiRoutes,
  type CountyScoresResponse,
  CountyScoresResponseSchema,
  type CountyScoresStatusResponse,
  CountyScoresStatusResponseSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import {
  queryCountyScores,
  queryCountyScoresStatus,
} from "@/geo/county-scores/county-scores.service";
import {
  buildCountyScoresMappingRouteError,
  buildCountyScoresQueryRouteError,
  buildCountyScoresSourceUnavailableRouteError,
  buildCountyScoresStatusMappingRouteError,
  buildCountyScoresStatusQueryRouteError,
  buildCountyScoresStatusSourceUnavailableRouteError,
} from "@/geo/county-scores/county-scores-route-errors.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";
import type {
  BuildCountyScoresResponseMeta,
  CountyScoresQueryParamsResult,
} from "./county-scores.route.types";

const COUNTY_ID_LIMIT = 500;
const COUNTY_ID_PATTERN = /^[0-9]{5}$/;
const COUNTY_SCORES_UNPUBLISHED_META_VERSION = "unpublished";

const buildResponseMeta: BuildCountyScoresResponseMeta = (args) => {
  return {
    requestId: args.requestId,
    sourceMode: "postgis",
    dataVersion: args.dataVersion ?? COUNTY_SCORES_UNPUBLISHED_META_VERSION,
    generatedAt: new Date().toISOString(),
    recordCount: args.recordCount,
    truncated: false,
    warnings: [],
  };
};

function parseCountyIds(rawValue: string | undefined): CountyScoresQueryParamsResult {
  if (typeof rawValue !== "string") {
    return {
      ok: false,
      message: "countyIds query param is required",
    };
  }

  const countyIds = rawValue
    .split(",")
    .map((countyId) => countyId.trim())
    .filter((countyId) => countyId.length > 0);

  if (countyIds.length === 0) {
    return {
      ok: false,
      message: "countyIds query param must include at least one county id",
    };
  }

  if (countyIds.length > COUNTY_ID_LIMIT) {
    return {
      ok: false,
      message: `countyIds query param must include at most ${String(COUNTY_ID_LIMIT)} county ids`,
    };
  }

  for (const countyId of countyIds) {
    if (!COUNTY_ID_PATTERN.test(countyId)) {
      return {
        ok: false,
        message: "countyIds query param must contain only 5-digit county ids",
      };
    }
  }

  return {
    ok: true,
    value: {
      countyIds,
    },
  };
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

export function registerCountyScoresRoute<E extends Env>(app: Hono<E>): void {
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

        const payload: CountyScoresStatusResponse = {
          ...countyScoresStatusResult.value,
          meta: buildResponseMeta({
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

        const countyIdsResult = parseCountyIds(honoContext.req.query("countyIds"));
        if (!countyIdsResult.ok) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_COUNTY_IDS",
            message: countyIdsResult.message,
          });
        }

        const countyScoresResult = await queryCountyScores({
          countyIds: countyIdsResult.value.countyIds,
        });

        if (!countyScoresResult.ok) {
          throw countyScoresRouteError(
            countyScoresResult.value.reason,
            countyScoresResult.value.error
          );
        }

        const payload: CountyScoresResponse = {
          rows: [...countyScoresResult.value.rows],
          summary: {
            blockedCountyIds: [...countyScoresResult.value.blockedCountyIds],
            deferredCountyIds: [...countyScoresResult.value.deferredCountyIds],
            requestedCountyIds: [...countyScoresResult.value.requestedCountyIds],
            missingCountyIds: [...countyScoresResult.value.missingCountyIds],
          },
          meta: buildResponseMeta({
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
