import {
  ApiRoutes,
  type BoundaryPowerFeatureCollection,
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  BoundaryPowerLevelSchema,
  type ResponseMeta,
} from "@map-migration/contracts";
import type { Hono } from "hono";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "../../http/api-response";
import { getApiRuntimeConfig } from "../../http/runtime-config";
import { mapBoundaryPowerRowsToFeatures } from "./boundaries.mapper";
import { type BoundaryPowerRow, listBoundaryPower } from "./boundaries.repo";

function buildResponseMeta(args: {
  readonly requestId: string;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: ReadonlyArray<{ code: string; message: string }>;
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
  const parsed = BoundaryPowerLevelSchema.safeParse(value ?? defaultBoundaryLevel());
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

type QueryRowsResult =
  | { readonly ok: true; readonly rows: readonly BoundaryPowerRow[] }
  | { readonly error: unknown; readonly ok: false };

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

type MapFeaturesResult =
  | { readonly features: BoundaryPowerFeatureCollection["features"]; readonly ok: true }
  | { readonly error: unknown; readonly ok: false };

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

export function registerBoundariesRoute(app: Hono): void {
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
