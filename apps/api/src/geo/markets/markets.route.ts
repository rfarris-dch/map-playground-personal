import type { Warning } from "@map-migration/geo-kernel/warning";
import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type MarketSelectionResponse,
  type MarketsSelectionRequest,
  MarketsSelectionRequestSchema,
  MarketsSelectionResponseSchema,
} from "@map-migration/http-contracts/markets-selection-http";
import {
  type MarketSortBy,
  MarketSortBySchema,
  type MarketsTableResponse,
  MarketsTableResponseSchema,
  type SortDirection,
  SortDirectionSchema,
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
import { resolvePaginationParams, totalPages } from "@/http/pagination-params.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";

function resolveMarketSortBy(value: string | undefined): MarketSortBy | null {
  if (typeof value === "undefined") {
    return "name";
  }

  const parsed = MarketSortBySchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function resolveSortDirection(value: string | undefined): SortDirection | null {
  if (typeof value === "undefined") {
    return "asc";
  }

  const parsed = SortDirectionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function resolveMarketsTableQuery(honoContext: Context) {
  const paginationResolution = resolvePaginationParams(
    honoContext.req.query("page"),
    honoContext.req.query("pageSize"),
    {
      defaultPageSize: 100,
      maxPageSize: 500,
      maxOffset: 1_000_000,
    }
  );

  if (!paginationResolution.ok) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_PAGINATION",
      message: paginationResolution.message,
    });
  }

  const sortBy = resolveMarketSortBy(honoContext.req.query("sortBy"));
  if (sortBy === null) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SORT",
      message:
        "sortBy must be one of: name, region, country, state, absorption, vacancy, updatedAt",
    });
  }

  const sortOrder = resolveSortDirection(honoContext.req.query("sortOrder"));
  if (sortOrder === null) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_SORT",
      message: "sortOrder must be one of: asc, desc",
    });
  }

  return {
    pagination: paginationResolution.value,
    sortBy,
    sortOrder,
  };
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
  return {
    matchedMarkets: [...args.result.value.matchedMarkets],
    meta: {
      requestId: args.requestId,
      sourceMode: "postgis",
      dataVersion: "dev",
      generatedAt: new Date().toISOString(),
      recordCount: args.result.value.matchedMarkets.length,
      truncated: args.result.value.truncated,
      warnings: [...args.geometryWarnings, ...args.result.value.warnings],
    },
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
  app.get(ApiRoutes.markets, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const query = resolveMarketsTableQuery(honoContext);

        const queryResult = await queryMarketsTable({
          limit: query.pagination.pageSize,
          offset: query.pagination.offset,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        });

        if (!queryResult.ok) {
          throw buildMarketsTableRouteError(queryResult.value.error, queryResult.value.reason);
        }

        const payload: MarketsTableResponse = {
          rows: [...queryResult.value.rows],
          pagination: {
            page: query.pagination.page,
            pageSize: query.pagination.pageSize,
            totalCount: queryResult.value.totalCount,
            totalPages: totalPages(queryResult.value.totalCount, query.pagination.pageSize),
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
