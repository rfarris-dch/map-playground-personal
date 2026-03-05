import {
  ApiRoutes,
  type ParcelDetailResponse,
  ParcelDetailResponseSchema,
} from "@map-migration/contracts";
import type { Hono } from "hono";
import { getOrCreateRequestId, jsonError, jsonOk } from "../../../http/api-response";
import { mapParcelRowToFeature } from "../parcels.mapper";
import { getParcelById, type ParcelRow } from "../parcels.repo";
import {
  parcelMappingFailed,
  postgisQueryFailed,
  rejectWithBadRequest,
} from "./parcels-route-errors.service";
import {
  buildParcelMeta,
  conflictResponseIfNeeded,
  parseIncludeGeometryParam,
  parseProfileParam,
  profileMetadataWarnings,
  readExpectedIngestionRunId,
} from "./parcels-route-meta.service";

export function registerParcelDetailRoute(app: Hono): void {
  app.get(`${ApiRoutes.parcels}/:parcel-id`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const expectedIngestionRunId = readExpectedIngestionRunId(c);

    const parcelId = c.req.param("parcel-id").trim();
    if (parcelId.length === 0) {
      return rejectWithBadRequest(c, requestId, "parcel-id path param is required");
    }

    const includeGeometry = parseIncludeGeometryParam(c.req.query("includeGeometry"), "full");
    if (includeGeometry === null) {
      return rejectWithBadRequest(
        c,
        requestId,
        "includeGeometry query param must be one of: none, centroid, simplified, full"
      );
    }

    const profile = parseProfileParam(c.req.query("profile"), "full_170");
    if (profile === null) {
      return rejectWithBadRequest(
        c,
        requestId,
        "profile query param must be one of: analysis_v1, full_170"
      );
    }

    let rows: ParcelRow[] = [];
    try {
      rows = await getParcelById(parcelId, includeGeometry);
    } catch (error) {
      return postgisQueryFailed(c, requestId, error);
    }

    const row = rows[0];
    if (typeof row === "undefined") {
      return jsonError(c, {
        requestId,
        httpStatus: 404,
        code: "PARCEL_NOT_FOUND",
        message: "parcel not found",
      });
    }

    let feature: ParcelDetailResponse["feature"] | null = null;
    try {
      feature = mapParcelRowToFeature(row);
    } catch (error) {
      return parcelMappingFailed(c, requestId, error);
    }

    if (feature === null) {
      return jsonError(c, {
        requestId,
        httpStatus: 500,
        code: "PARCEL_MAPPING_FAILED",
        message: "parcel mapping failed",
      });
    }

    const conflictResponse = conflictResponseIfNeeded(
      c,
      requestId,
      expectedIngestionRunId,
      feature.lineage.ingestionRunId ?? undefined,
      1
    );
    if (conflictResponse) {
      return conflictResponse;
    }

    const payload: ParcelDetailResponse = {
      feature,
      meta: buildParcelMeta({
        requestId,
        profile,
        includeGeometry,
        recordCount: 1,
        truncated: false,
        warnings: profileMetadataWarnings(profile),
        nextCursor: null,
        ingestionRunId: feature.lineage.ingestionRunId ?? undefined,
      }),
    };

    return jsonOk(c, ParcelDetailResponseSchema, payload, requestId);
  });
}
