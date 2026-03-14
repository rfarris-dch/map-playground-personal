import type { Warning } from "@map-migration/geo-kernel/warning";
import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type MarketSelectionResponse,
  type MarketsSelectionRequest,
  MarketsSelectionRequestSchema,
  MarketsSelectionResponseSchema,
} from "@map-migration/http-contracts/markets-selection-http";
import {
  type MarketsTableRequest,
  MarketsTableRequestSchema,
  type MarketsTableResponse,
  MarketsTableResponseSchema,
} from "@map-migration/http-contracts/table-contracts";
import type { Context, Env, Hono } from "hono";
import { queryMarketsTable } from "@/geo/markets/markets-query.service";
import {
  buildMarketsBoundarySourceUnavailableRouteError,
  buildMarketsSelectionMappingRouteError,
  buildMarketsSelectionQueryRouteError,
} from "@/geo/markets/markets-route-errors.service";
import { queryMarketsBySelection } from "@/geo/markets/markets-selection.service";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { totalPages } from "@/http/pagination-params.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import { buildResponseMeta, setCacheControlHeader } from "@/http/response-meta.service";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { getDatasetCacheTtlSeconds } from "@/http/spatial-analysis-policy.service";

function resolveMarketsTableQuery(honoContext: Context): MarketsTableRequest {
  const request = MarketsTableRequestSchema.safeParse({
    page: honoContext.req.query("page"),
    pageSize: honoContext.req.query("pageSize"),
    sortBy: honoContext.req.query("sortBy"),
    sortOrder: honoContext.req.query("sortOrder"),
  });
  if (!request.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_MARKETS_TABLE_REQUEST",
      message: "invalid markets table request",
      details: toDebugDetails(request.error),
    });
  }

  return request.data;
}

function buildMarketsTableRouteError(error: unknown, reason: "mapping_failed" | "query_failed") {
  return routeError({
    httpStatus: reason === "query_failed" ? 503 : 500,
    code: reason === "query_failed" ? "MARKET_QUERY_FAILED" : "MARKET_MAPPING_FAILED",
    message: reason === "query_failed" ? "market query failed" : "market mapping failed",
    details: toDebugDetails(error),
  });
}

async function readMarketsSelectionRequest(c: Context, requestId: string) {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsedRequest = MarketsSelectionRequestSchema.safeParse(bodyResult.value);
  if (!parsedRequest.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_MARKET_SELECTION_REQUEST",
      message: "invalid market selection request payload",
      details: toDebugDetails(parsedRequest.error),
    });
  }

  return {
    ok: true as const,
    value: parsedRequest.data,
  };
}

async function normalizeMarketSelectionGeometry(
  geometry: MarketsSelectionRequest["geometry"]
): Promise<{
  readonly geometryText: string;
  readonly warnings: readonly Warning[];
}> {
  const geometryWarnings: Warning[] = [];
  const normalizedGeometry = await normalizePolygonGeometryGeoJson(JSON.stringify(geometry));

  if (normalizedGeometry.wasRepaired) {
    geometryWarnings.push(
      buildPolygonRepairWarning("market selection", normalizedGeometry.invalidReason)
    );
  }

  return {
    geometryText: normalizedGeometry.geometryText,
    warnings: geometryWarnings,
  };
}

function throwMarketsSelectionRouteError(
  result: Exclude<Awaited<ReturnType<typeof queryMarketsBySelection>>, { readonly ok: true }>
): never {
  if (result.value.reason === "boundary_source_unavailable") {
    throw buildMarketsBoundarySourceUnavailableRouteError(result.value.error);
  }

  throw result.value.reason === "query_failed"
    ? buildMarketsSelectionQueryRouteError(result.value.error)
    : buildMarketsSelectionMappingRouteError(result.value.error);
}

function buildMarketsSelectionPayload(args: {
  readonly geometryWarnings: readonly Warning[];
  readonly requestId: string;
  readonly request: MarketsSelectionRequest;
  readonly result: Extract<
    Awaited<ReturnType<typeof queryMarketsBySelection>>,
    { readonly ok: true }
  >;
}): MarketSelectionResponse {
  const runtimeConfig = getApiRuntimeConfig();
  return {
    matchedMarkets: [...args.result.value.matchedMarkets],
    meta: buildResponseMeta({
      dataVersion: runtimeConfig.dataVersion,
      recordCount: args.result.value.matchedMarkets.length,
      requestId: args.requestId,
      sourceMode: runtimeConfig.marketsSourceMode,
      truncated: args.result.value.truncated,
      warnings: [...args.geometryWarnings, ...args.result.value.warnings],
    }),
    primaryMarket: args.result.value.primaryMarket,
    selection: {
      matchCount: args.result.value.matchedMarkets.length,
      minimumSelectionOverlapPercent: args.request.minimumSelectionOverlapPercent,
      primaryMarketId: args.result.value.primaryMarket?.marketId ?? null,
      selectionAreaSqKm: args.result.value.selectionAreaSqKm,
    },
  };
}

export function registerMarketsRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(ApiRoutes.marketsSelection, "selection");

  app.get(ApiRoutes.markets, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const query = resolveMarketsTableQuery(honoContext);
        const offset = query.page * query.pageSize;

        const queryResult = await queryMarketsTable({
          limit: query.pageSize,
          offset,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        });

        if (!queryResult.ok) {
          throw buildMarketsTableRouteError(queryResult.value.error, queryResult.value.reason);
        }

        setCacheControlHeader(honoContext, getDatasetCacheTtlSeconds("market_metrics"));

        const payload: MarketsTableResponse = {
          rows: [...queryResult.value.rows],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            totalCount: queryResult.value.totalCount,
            totalPages: totalPages(queryResult.value.totalCount, query.pageSize),
          },
        };

        return jsonOk(honoContext, MarketsTableResponseSchema, payload, requestId);
      })
    )
  );

  app.post(ApiRoutes.marketsSelection, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const requestResult = await readMarketsSelectionRequest(honoContext, requestId);
        if (!requestResult.ok) {
          return requestResult.response;
        }

        const normalizedSelection = await normalizeMarketSelectionGeometry(
          requestResult.value.geometry
        ).catch((error: unknown) => {
          throw routeError({
            httpStatus: 422,
            code: "POLICY_REJECTED",
            message:
              error instanceof Error
                ? `market selection polygon is invalid after repair: ${error.message}`
                : "market selection polygon is invalid after repair",
          });
        });

        const selectionResult = await queryMarketsBySelection({
          geometryGeoJson: normalizedSelection.geometryText,
          limit: requestResult.value.limit,
          minimumSelectionOverlapPercent: requestResult.value.minimumSelectionOverlapPercent,
        });

        if (!selectionResult.ok) {
          throwMarketsSelectionRouteError(selectionResult);
        }

        const payload = buildMarketsSelectionPayload({
          geometryWarnings: normalizedSelection.warnings,
          requestId,
          request: requestResult.value,
          result: selectionResult,
        });

        return jsonOk(honoContext, MarketsSelectionResponseSchema, payload, requestId);
      })
    )
  );
}
