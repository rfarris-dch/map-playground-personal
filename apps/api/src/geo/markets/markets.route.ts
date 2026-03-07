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
import type { Env, Hono } from "hono";
import { queryMarketsTable } from "@/geo/markets/markets-query.service";
import {
  marketsBoundarySourceUnavailableError,
  marketsSelectionMappingError,
  marketsSelectionQueryError,
} from "@/geo/markets/markets-route-errors.service";
import { queryMarketsBySelection } from "@/geo/markets/markets-selection.service";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "@/http/api-response";
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

export function registerMarketsRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.markets, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const paginationResolution = resolvePaginationParams(
      c.req.query("page"),
      c.req.query("pageSize"),
      {
        defaultPageSize: 100,
        maxPageSize: 500,
        maxOffset: 1_000_000,
      }
    );

    if (!paginationResolution.ok) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_PAGINATION",
        message: paginationResolution.message,
      });
    }

    const pagination = paginationResolution.value;
    const sortBy = resolveMarketSortBy(c.req.query("sortBy"));
    if (sortBy === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SORT",
        message:
          "sortBy must be one of: name, region, country, state, absorption, vacancy, updatedAt",
      });
    }
    const sortOrder = resolveSortDirection(c.req.query("sortOrder"));
    if (sortOrder === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SORT",
        message: "sortOrder must be one of: asc, desc",
      });
    }

    const queryResult = await queryMarketsTable({
      limit: pagination.pageSize,
      offset: pagination.offset,
      sortBy,
      sortOrder,
    });

    if (!queryResult.ok) {
      if (queryResult.value.reason === "query_failed") {
        return jsonError(c, {
          requestId,
          httpStatus: 503,
          code: "MARKET_QUERY_FAILED",
          message: "market query failed",
          details: toDebugDetails(queryResult.value.error),
        });
      }

      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "MARKET_MAPPING_FAILED",
        message: "market mapping failed",
        details: toDebugDetails(queryResult.value.error),
      });
    }

    const payload: MarketsTableResponse = {
      rows: [...queryResult.value.rows],
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalCount: queryResult.value.totalCount,
        totalPages: totalPages(queryResult.value.totalCount, pagination.pageSize),
      },
    };

    return jsonOk(c, MarketsTableResponseSchema, payload, requestId);
  });

  app.post(ApiRoutes.marketsSelection, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const bodyResult = await readJsonBody(c, {
      requestId,
      invalidJsonMessage: "invalid JSON body",
    });
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const parsedRequest = MarketsSelectionRequestSchema.safeParse(bodyResult.value);
    if (!parsedRequest.success) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_MARKET_SELECTION_REQUEST",
        message: "invalid market selection request payload",
        details: toDebugDetails(parsedRequest.error),
      });
    }

    const geometryText = JSON.stringify(parsedRequest.data.geometry);
    const selectionResult = await queryMarketsBySelection({
      geometryGeoJson: geometryText,
      limit: parsedRequest.data.limit,
      minimumSelectionOverlapPercent: parsedRequest.data.minimumSelectionOverlapPercent,
    });

    if (!selectionResult.ok) {
      if (selectionResult.value.reason === "boundary_source_unavailable") {
        return marketsBoundarySourceUnavailableError(c, {
          requestId,
          error: selectionResult.value.error,
        });
      }

      if (selectionResult.value.reason === "query_failed") {
        return marketsSelectionQueryError(c, {
          requestId,
          error: selectionResult.value.error,
        });
      }

      return marketsSelectionMappingError(c, {
        requestId,
        error: selectionResult.value.error,
      });
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

    return jsonOk(c, MarketsSelectionResponseSchema, payload, requestId);
  });
}
