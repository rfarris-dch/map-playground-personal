import {
  ApiRoutes,
  type MarketSelectionResponse,
  type MarketSortBy,
  MarketSortBySchema,
  MarketsSelectionRequestSchema,
  MarketsSelectionResponseSchema,
  type MarketsTableResponse,
  MarketsTableResponseSchema,
  type SortDirection,
  SortDirectionSchema,
} from "@map-migration/contracts";
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
        const bodyResult = await readJsonBody(honoContext, {
          requestId,
          invalidJsonMessage: "invalid JSON body",
        });
        if (!bodyResult.ok) {
          return bodyResult.response;
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

        const selectionResult = await queryMarketsBySelection({
          geometryGeoJson: JSON.stringify(parsedRequest.data.geometry),
          limit: parsedRequest.data.limit,
          minimumSelectionOverlapPercent: parsedRequest.data.minimumSelectionOverlapPercent,
        });

        if (!selectionResult.ok) {
          if (selectionResult.value.reason === "boundary_source_unavailable") {
            throw buildMarketsBoundarySourceUnavailableRouteError(selectionResult.value.error);
          }

          throw selectionResult.value.reason === "query_failed"
            ? buildMarketsSelectionQueryRouteError(selectionResult.value.error)
            : buildMarketsSelectionMappingRouteError(selectionResult.value.error);
        }

        const payload: MarketSelectionResponse = {
          matchedMarkets: [...selectionResult.value.matchedMarkets],
          meta: {
            requestId,
            sourceMode: "postgis",
            dataVersion: "dev",
            generatedAt: new Date().toISOString(),
            recordCount: selectionResult.value.matchedMarkets.length,
            truncated: false,
            warnings: [],
          },
          primaryMarket: selectionResult.value.primaryMarket,
          selection: {
            matchCount: selectionResult.value.matchedMarkets.length,
            minimumSelectionOverlapPercent: parsedRequest.data.minimumSelectionOverlapPercent,
            primaryMarketId: selectionResult.value.primaryMarket?.marketId ?? null,
            selectionAreaSqKm: selectionResult.value.selectionAreaSqKm,
          },
        };

        return jsonOk(honoContext, MarketsSelectionResponseSchema, payload, requestId);
      })
    )
  );
}
