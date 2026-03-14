import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type BoundaryPowerFeatureCollection,
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  BoundaryPowerRequestSchema,
} from "@map-migration/http-contracts/boundaries-http";
import type { Env, Hono } from "hono";
import { mapBoundaryPowerRowsToFeatures } from "@/geo/boundaries/boundaries.mapper";
import { type BoundaryPowerRow, listBoundaryPower } from "@/geo/boundaries/boundaries.repo";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { buildResponseMeta, setCacheControlHeader } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { getDatasetCacheTtlSeconds } from "@/http/spatial-analysis-policy.service";
import type { MapFeaturesResult, QueryRowsResult } from "./boundaries.route.types";

function queryBoundaryRows(level: BoundaryPowerLevel): Promise<QueryRowsResult> {
  return listBoundaryPower(level).then(
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

function mapBoundaryFeatures(
  rows: readonly BoundaryPowerRow[],
  level: BoundaryPowerLevel
): MapFeaturesResult {
  try {
    const features = mapBoundaryPowerRowsToFeatures(rows, level);
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

export function registerBoundariesRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.boundariesPower, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = BoundaryPowerRequestSchema.safeParse({
          level: honoContext.req.query("level"),
        });
        if (!request.success) {
          throw routeError({
            httpStatus: 400,
            code: "INVALID_LEVEL",
            message: "invalid boundary power request",
            details: toDebugDetails(request.error),
          });
        }

        const rowsResult = await queryBoundaryRows(request.data.level);

        if (!rowsResult.ok) {
          throw routeError({
            httpStatus: 503,
            code: "POSTGIS_QUERY_FAILED",
            message: "postgis boundary query failed",
            details: toDebugDetails(rowsResult.error),
          });
        }

        const featuresResult = mapBoundaryFeatures(rowsResult.rows, request.data.level);

        if (!featuresResult.ok) {
          throw routeError({
            httpStatus: 500,
            code: "BOUNDARY_MAPPING_FAILED",
            message: "boundary mapping failed",
            details: toDebugDetails(featuresResult.error),
          });
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("power"));

        const payload: BoundaryPowerFeatureCollection = {
          type: "FeatureCollection",
          features: featuresResult.features,
          meta: buildResponseMeta({
            dataVersion: getApiRuntimeConfig().dataVersion,
            requestId,
            recordCount: featuresResult.features.length,
            sourceMode: getApiRuntimeConfig().boundariesSourceMode,
          }),
        };

        return jsonOk(honoContext, BoundaryPowerFeatureCollectionSchema, payload, requestId);
      })
    )
  );
}
