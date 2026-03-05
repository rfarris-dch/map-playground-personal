import {
  ApiRoutes,
  type BoundaryPowerFeatureCollection,
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  parseBoundaryPowerLevelParam,
  type ResponseMeta,
  type Warning,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { mapBoundaryPowerRowsToFeatures } from "@/geo/boundaries/boundaries.mapper";
import { type BoundaryPowerRow, listBoundaryPower } from "@/geo/boundaries/boundaries.repo";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "@/http/api-response";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import type { MapFeaturesResult, QueryRowsResult } from "./boundaries.route.types";

function buildResponseMeta(args: {
  readonly requestId: string;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}): ResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  return {
    requestId: args.requestId,
    sourceMode: runtimeConfig.boundariesSourceMode,
    dataVersion: runtimeConfig.dataVersion,
    generatedAt: new Date().toISOString(),
    recordCount: args.recordCount,
    truncated: args.truncated,
    warnings: [...args.warnings],
  };
}

function defaultBoundaryLevel(): BoundaryPowerLevel {
  return "county";
}

function parseBoundaryLevel(value: string | undefined): BoundaryPowerLevel | null {
  if (typeof value === "undefined") {
    return defaultBoundaryLevel();
  }

  return parseBoundaryPowerLevelParam(value);
}

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
  app.get(ApiRoutes.boundariesPower, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const level = parseBoundaryLevel(c.req.query("level"));
    if (level === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_LEVEL",
        message: "level query param must be one of: county, state, country",
      });
    }

    const rowsResult = await queryBoundaryRows(level);
    if (!rowsResult.ok) {
      return jsonError(c, {
        requestId,
        httpStatus: 503,
        code: "POSTGIS_QUERY_FAILED",
        message: "postgis boundary query failed",
        details: toDebugDetails(rowsResult.error),
      });
    }

    const featuresResult = mapBoundaryFeatures(rowsResult.rows, level);
    if (!featuresResult.ok) {
      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "BOUNDARY_MAPPING_FAILED",
        message: "boundary mapping failed",
        details: toDebugDetails(featuresResult.error),
      });
    }

    const payload: BoundaryPowerFeatureCollection = {
      type: "FeatureCollection",
      features: featuresResult.features,
      meta: buildResponseMeta({
        requestId,
        recordCount: featuresResult.features.length,
        truncated: false,
        warnings: [],
      }),
    };

    return jsonOk(c, BoundaryPowerFeatureCollectionSchema, payload, requestId);
  });
}
