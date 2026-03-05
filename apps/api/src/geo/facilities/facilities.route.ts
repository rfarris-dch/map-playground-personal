import {
  ApiRoutes,
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
  type FacilitiesFeatureCollection,
  FacilitiesFeatureCollectionSchema,
  type FacilitiesTableResponse,
  FacilitiesTableResponseSchema,
  parseBboxParam,
} from "@map-migration/contracts";
import type { Hono } from "hono";
import { getOrCreateRequestId, jsonError, jsonOk, toDebugDetails } from "../../http/api-response";
import { resolvePaginationParams, totalPages } from "../../http/pagination-params.service";
import { getFacilitiesBboxMaxRows } from "./facilities.repo";
import { buildFacilitiesRouteMeta } from "./route/facilities-route-meta.service";
import {
  clampLimit,
  resolveFacilitySortBy,
  resolvePerspectiveParam,
  resolveSortDirection,
} from "./route/facilities-route-param.service";
import {
  queryFacilitiesByBbox,
  queryFacilitiesTable,
  queryFacilityDetail,
} from "./route/facilities-route-query.service";

export function registerFacilitiesRoute(app: Hono): void {
  const defaultLimit = 2000;

  app.get(ApiRoutes.facilities, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const bboxRaw = c.req.query("bbox");
    const bbox = bboxRaw ? parseBboxParam(bboxRaw) : null;

    if (!bbox) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_BBOX",
        message: "bbox query param required: west,south,east,north",
      });
    }

    const perspectiveResolution = resolvePerspectiveParam(c.req.query("perspective"));
    if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_PERSPECTIVE",
        message: perspectiveResolution.error ?? "perspective query param is invalid",
      });
    }

    const perspective = perspectiveResolution.perspective;
    const maxRows = getFacilitiesBboxMaxRows(perspective);
    const limit = clampLimit(c.req.query("limit"), maxRows, defaultLimit);

    const queryResult = await queryFacilitiesByBbox({
      bbox,
      limit,
      perspective,
    });

    if (!queryResult.ok) {
      if (queryResult.value.reason === "query_failed") {
        return jsonError(c, {
          requestId,
          httpStatus: 503,
          code: "POSTGIS_QUERY_FAILED",
          message: "postgis query failed",
          details: toDebugDetails(queryResult.value.error),
        });
      }

      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "FACILITY_MAPPING_FAILED",
        message: "facility mapping failed",
        details: toDebugDetails(queryResult.value.error),
      });
    }

    const payload: FacilitiesFeatureCollection = {
      type: "FeatureCollection",
      features: queryResult.value.features,
      meta: buildFacilitiesRouteMeta({
        requestId,
        recordCount: queryResult.value.features.length,
        truncated: queryResult.value.truncated,
        warnings: queryResult.value.warnings,
      }),
    };

    return jsonOk(c, FacilitiesFeatureCollectionSchema, payload, requestId);
  });

  app.get(ApiRoutes.facilitiesTable, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const perspectiveResolution = resolvePerspectiveParam(c.req.query("perspective"));
    if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_PERSPECTIVE",
        message: perspectiveResolution.error ?? "perspective query param is invalid",
      });
    }

    const perspective = perspectiveResolution.perspective;

    const paginationResolution = resolvePaginationParams(
      c.req.query("page"),
      c.req.query("pageSize"),
      {
        defaultPageSize: 100,
        maxPageSize: 500,
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
    const sortBy = resolveFacilitySortBy(c.req.query("sortBy"));
    if (sortBy === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_SORT",
        message:
          "sortBy must be one of: facilityName, providerId, stateAbbrev, commissionedSemantic, leaseOrOwn, commissionedPowerMw, plannedPowerMw, underConstructionPowerMw, availablePowerMw, updatedAt",
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

    const queryResult = await queryFacilitiesTable({
      perspective,
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
          code: "FACILITY_QUERY_FAILED",
          message: "facility query failed",
          details: toDebugDetails(queryResult.value.error),
        });
      }

      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "FACILITY_MAPPING_FAILED",
        message: "facility mapping failed",
        details: toDebugDetails(queryResult.value.error),
      });
    }

    const payload: FacilitiesTableResponse = {
      rows: [...queryResult.value.rows],
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalCount: queryResult.value.totalCount,
        totalPages: totalPages(queryResult.value.totalCount, pagination.pageSize),
      },
    };

    return jsonOk(c, FacilitiesTableResponseSchema, payload, requestId);
  });

  app.get(`${ApiRoutes.facilities}/:facility-id`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");

    const perspectiveResolution = resolvePerspectiveParam(c.req.query("perspective"));
    if (!(perspectiveResolution.ok && perspectiveResolution.perspective)) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_PERSPECTIVE",
        message: perspectiveResolution.error ?? "perspective query param is invalid",
      });
    }

    const perspective = perspectiveResolution.perspective;

    const facilityId = c.req.param("facility-id").trim();
    if (facilityId.length === 0) {
      return jsonError(c, {
        requestId,
        httpStatus: 400,
        code: "INVALID_FACILITY_ID",
        message: "facility-id path param is required",
      });
    }

    const queryResult = await queryFacilityDetail({
      facilityId,
      perspective,
    });

    if (!queryResult.ok) {
      if (queryResult.value.reason === "not_found") {
        return jsonError(c, {
          requestId,
          httpStatus: 404,
          code: "FACILITY_NOT_FOUND",
          message: "facility not found",
        });
      }

      if (queryResult.value.reason === "query_failed") {
        return jsonError(c, {
          requestId,
          httpStatus: 503,
          code: "POSTGIS_QUERY_FAILED",
          message: "postgis query failed",
          details: toDebugDetails(queryResult.value.error),
        });
      }

      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "FACILITY_MAPPING_FAILED",
        message: "facility mapping failed",
        details: toDebugDetails(queryResult.value.error),
      });
    }

    const payload: FacilitiesDetailResponse = {
      feature: queryResult.value.feature,
      meta: buildFacilitiesRouteMeta({
        requestId,
        recordCount: 1,
        truncated: false,
        warnings: [],
      }),
    };

    return jsonOk(c, FacilitiesDetailResponseSchema, payload, requestId);
  });
}
