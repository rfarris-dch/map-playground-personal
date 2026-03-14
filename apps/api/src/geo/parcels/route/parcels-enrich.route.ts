import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type ParcelEnrichRequest,
  ParcelEnrichRequestSchema,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/http-contracts/parcels-http";
import type { Context, Env, Hono } from "hono";
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
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import type { ReadJsonBodyFailure } from "@/http/json-request.service.types";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

type ReadParcelsEnrichRequestResult =
  | ReadJsonBodyFailure
  | {
      readonly ok: true;
      readonly value: ParcelEnrichRequest;
    };

async function readParcelsEnrichRequest(
  c: Context,
  requestId: string
): Promise<ReadParcelsEnrichRequestResult> {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsed = ParcelEnrichRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return {
      ok: false,
      response: rejectWithBadRequest(c, requestId, "invalid parcel enrich request payload"),
    };
  }

  return {
    ok: true as const,
    value: parsed.data,
  };
}

export function registerParcelsEnrichRoute<E extends Env>(app: Hono<E>): void {
  app.post(`${ApiRoutes.parcels}/enrich`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const expectedIngestionRunId = readExpectedIngestionRunId(honoContext);
        const requestResult = await readParcelsEnrichRequest(honoContext, requestId);
        if (!requestResult.ok) {
          return requestResult.response;
        }

        if (!isDatasetQueryAllowed("parcels", requestResult.value.aoi.type)) {
          return rejectWithPolicyError(
            honoContext,
            requestId,
            `query granularity "${requestResult.value.aoi.type}" is not allowed for parcels`
          );
        }

        const pageSizeResolution = resolvePageSize(requestResult.value.pageSize);
        const warnings = pageSizeResolution.warnings;
        const pageSize = pageSizeResolution.pageSize;

        const cursor = coerceCursor(requestResult.value.cursor);
        const queryLimit = pageSize + 1;

        let enrichRowsResult: EnrichRowsResult;
        try {
          enrichRowsResult = await queryEnrichRowsByAoi(
            honoContext,
            requestId,
            requestResult.value.aoi,
            requestResult.value.includeGeometry,
            queryLimit,
            cursor
          );
        } catch (error) {
          return postgisQueryFailed(honoContext, requestId, error);
        }

        if (!enrichRowsResult.ok) {
          return enrichRowsResult.response;
        }

        let mappedFeatures: ParcelsFeatureCollection["features"];
        try {
          mappedFeatures = mapParcelRowsToFeatures(enrichRowsResult.rows);
        } catch (error) {
          return parcelMappingFailed(honoContext, requestId, error);
        }

        const paginated = paginateEnrichFeatures(mappedFeatures, pageSize, warnings);
        const features = paginated.features;
        const hasMore = paginated.hasMore;
        const responseWarnings = [
          ...enrichRowsResult.warnings,
          ...warnings,
          ...profileMetadataWarnings(requestResult.value.profile),
        ];
        const actualIngestionRunId = readIngestionRunId(features);
        const conflictResponse = conflictResponseIfNeeded(
          honoContext,
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
            profile: requestResult.value.profile,
            includeGeometry: requestResult.value.includeGeometry,
            aoiType: requestResult.value.aoi.type,
            recordCount: features.length,
            truncated: hasMore,
            warnings: responseWarnings,
            nextCursor: paginated.nextCursor,
            ingestionRunId: readIngestionRunId(features),
          }),
        };

        return jsonOk(honoContext, ParcelsFeatureCollectionSchema, payload, requestId);
      })
    )
  );
}
