import {
  ApiRoutes,
  ParcelEnrichRequestSchema,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { mapParcelRowsToFeatures } from "@/geo/parcels/parcels.mapper";
import {
  type EnrichRowsResult,
  queryEnrichRowsByAoi,
} from "@/geo/parcels/route/parcels-route-aoi-query.service";
import {
  coerceCursor,
  paginateEnrichFeatures,
  resolvePageSize,
} from "@/geo/parcels/route/parcels-route-enrich.service";
import {
  parcelMappingFailed,
  postgisQueryFailed,
  rejectWithBadRequest,
  rejectWithPolicyError,
} from "@/geo/parcels/route/parcels-route-errors.service";
import {
  buildParcelMeta,
  conflictResponseIfNeeded,
  profileMetadataWarnings,
  readExpectedIngestionRunId,
  readIngestionRunId,
} from "@/geo/parcels/route/parcels-route-meta.service";
import { getOrCreateRequestId, jsonOk } from "@/http/api-response";
import { readJsonBody } from "@/http/json-request.service";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

export function registerParcelsEnrichRoute<E extends Env>(app: Hono<E>): void {
  app.post(`${ApiRoutes.parcels}/enrich`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const expectedIngestionRunId = readExpectedIngestionRunId(c);
    const bodyResult = await readJsonBody(c, {
      requestId,
      invalidJsonMessage: "invalid JSON body",
    });
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const parsed = ParcelEnrichRequestSchema.safeParse(bodyResult.value);
    if (!parsed.success) {
      return rejectWithBadRequest(c, requestId, "invalid parcel enrich request payload");
    }

    if (!isDatasetQueryAllowed("parcels", parsed.data.aoi.type)) {
      return rejectWithPolicyError(
        c,
        requestId,
        `query granularity "${parsed.data.aoi.type}" is not allowed for parcels`
      );
    }

    const pageSizeResolution = resolvePageSize(parsed.data.pageSize);
    const warnings = pageSizeResolution.warnings;
    const pageSize = pageSizeResolution.pageSize;

    const cursor = coerceCursor(parsed.data.cursor);
    const queryLimit = pageSize + 1;

    let enrichRowsResult: EnrichRowsResult;
    try {
      enrichRowsResult = await queryEnrichRowsByAoi(
        c,
        requestId,
        parsed.data.aoi,
        parsed.data.includeGeometry,
        queryLimit,
        cursor
      );
    } catch (error) {
      return postgisQueryFailed(c, requestId, error);
    }

    if (!enrichRowsResult.ok) {
      return enrichRowsResult.response;
    }

    let mappedFeatures: ParcelsFeatureCollection["features"];
    try {
      mappedFeatures = mapParcelRowsToFeatures(enrichRowsResult.rows);
    } catch (error) {
      return parcelMappingFailed(c, requestId, error);
    }

    const paginated = paginateEnrichFeatures(mappedFeatures, pageSize, warnings);
    const features = paginated.features;
    const hasMore = paginated.hasMore;
    const responseWarnings = [...warnings, ...profileMetadataWarnings(parsed.data.profile)];
    const actualIngestionRunId = readIngestionRunId(features);
    const conflictResponse = conflictResponseIfNeeded(
      c,
      requestId,
      expectedIngestionRunId,
      actualIngestionRunId,
      features.length
    );
    if (conflictResponse) {
      return conflictResponse;
    }

    const payload: ParcelsFeatureCollection = {
      type: "FeatureCollection",
      features,
      meta: buildParcelMeta({
        requestId,
        profile: parsed.data.profile,
        includeGeometry: parsed.data.includeGeometry,
        aoiType: parsed.data.aoi.type,
        recordCount: features.length,
        truncated: hasMore,
        warnings: responseWarnings,
        nextCursor: paginated.nextCursor,
        ingestionRunId: readIngestionRunId(features),
      }),
    };

    return jsonOk(c, ParcelsFeatureCollectionSchema, payload, requestId);
  });
}
