import {
  ApiQueryDefaults,
  ApiRoutes,
  type ParcelDetailResponse,
  ParcelDetailResponseSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { mapParcelRowToFeature } from "@/geo/parcels/parcels.mapper";
import { getParcelById, type ParcelRow } from "@/geo/parcels/parcels.repo";
import {
  parcelMappingFailed,
  postgisQueryFailed,
  rejectWithBadRequest,
  rejectWithPolicyError,
} from "@/geo/parcels/route/parcels-route-errors.service";
import {
  buildParcelMeta,
  conflictResponseIfNeeded,
  parseIncludeGeometryParam,
  parseProfileParam,
  profileMetadataWarnings,
  readExpectedIngestionRunId,
} from "@/geo/parcels/route/parcels-route-meta.service";
import { getOrCreateRequestId, jsonError, jsonOk } from "@/http/api-response";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

export function registerParcelDetailRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.parcels}/:parcel-id`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const expectedIngestionRunId = readExpectedIngestionRunId(c);

    if (!isDatasetQueryAllowed("parcels", "parcel")) {
      return rejectWithPolicyError(c, requestId, 'query granularity "parcel" is not allowed');
    }

    const parcelId = c.req.param("parcel-id").trim();
    if (parcelId.length === 0) {
      return rejectWithBadRequest(c, requestId, "parcel-id path param is required");
    }

    const includeGeometry = parseIncludeGeometryParam(
      c.req.query("includeGeometry"),
      ApiQueryDefaults.parcelDetail.includeGeometry
    );
    if (includeGeometry === null) {
      return rejectWithBadRequest(
        c,
        requestId,
        "includeGeometry query param must be one of: none, centroid, simplified, full"
      );
    }

    const profile = parseProfileParam(
      c.req.query("profile"),
      ApiQueryDefaults.parcelDetail.profile
    );
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
