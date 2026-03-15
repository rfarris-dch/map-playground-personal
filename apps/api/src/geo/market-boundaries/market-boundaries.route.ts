import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type MarketBoundaryFeatureCollection,
  MarketBoundaryFeatureCollectionSchema,
  type MarketBoundaryLevel,
  MarketBoundaryRequestSchema,
} from "@map-migration/http-contracts/market-boundaries-http";
import type { Env, Hono } from "hono";
import { mapMarketBoundaryRowsToFeatures } from "@/geo/market-boundaries/market-boundaries.mapper";
import {
  listMarketBoundaries,
  type MarketBoundaryRow,
} from "@/geo/market-boundaries/market-boundaries.repo";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { buildResponseMeta, setCacheControlHeader } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { getDatasetCacheTtlSeconds } from "@/http/spatial-analysis-policy.service";
import type { MapFeaturesResult, QueryRowsResult } from "./market-boundaries.route.types";

function queryMarketBoundaryRows(level: MarketBoundaryLevel): Promise<QueryRowsResult> {
  return listMarketBoundaries(level).then(
    (rows) => ({
      ok: true,
      rows,
    }),
    (error: unknown) => ({
      ok: false,
      error,
    })
  );
}

function mapMarketBoundaryFeatures(
  rows: readonly MarketBoundaryRow[],
  level: MarketBoundaryLevel
): MapFeaturesResult {
  try {
    const features = mapMarketBoundaryRowsToFeatures(rows, level);
    return {
      ok: true,
      features,
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}

export function registerMarketBoundariesRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.marketBoundaries, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = MarketBoundaryRequestSchema.safeParse({
          level: honoContext.req.query("level"),
        });
        if (!request.success) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_LEVEL",
            message: "invalid market boundary request",
            details: toDebugDetails(request.error),
          });
        }

        const rowsResult = await queryMarketBoundaryRows(request.data.level);

        if (!rowsResult.ok) {
          throw routeError({
            httpStatus: 503,
            code: "POSTGIS_QUERY_FAILED",
            message: "postgis market boundary query failed",
            details: toDebugDetails(rowsResult.error),
          });
        }

        const featuresResult = mapMarketBoundaryFeatures(rowsResult.rows, request.data.level);

        if (!featuresResult.ok) {
          throw routeError({
            httpStatus: 500,
            code: "MARKET_BOUNDARY_MAPPING_FAILED",
            message: "market boundary mapping failed",
            details: toDebugDetails(featuresResult.error),
          });
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("market_metrics"));

        const payload: MarketBoundaryFeatureCollection = {
          type: "FeatureCollection",
          features: featuresResult.features,
          meta: buildResponseMeta({
            dataVersion: getApiRuntimeConfig().dataVersion,
            requestId,
            recordCount: featuresResult.features.length,
            sourceMode: getApiRuntimeConfig().marketBoundariesSourceMode,
          }),
        };

        return jsonOk(honoContext, MarketBoundaryFeatureCollectionSchema, payload, requestId);
      })
    )
  );
}
