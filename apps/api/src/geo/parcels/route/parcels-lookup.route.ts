import {
  ApiRoutes,
  ParcelLookupRequestSchema,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/http-contracts";
import type { Env, Hono } from "hono";
import { mapParcelRowsToFeatures } from "@/geo/parcels/parcels.mapper";
import { lookupParcelsByIds, type ParcelRow } from "@/geo/parcels/parcels.repo";
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
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

export function registerParcelsLookupRoute<E extends Env>(app: Hono<E>): void {
  app.post(`${ApiRoutes.parcels}/lookup`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const expectedIngestionRunId = readExpectedIngestionRunId(honoContext);
        const bodyResult = await readJsonBody(honoContext, {
          requestId,
          invalidJsonMessage: "invalid JSON body",
        });
        if (!bodyResult.ok) {
          return bodyResult.response;
        }

        const parsed = ParcelLookupRequestSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return rejectWithBadRequest(
            honoContext,
            requestId,
            "invalid parcel lookup request payload"
          );
        }

        if (!isDatasetQueryAllowed("parcels", "parcel")) {
          return rejectWithPolicyError(
            honoContext,
            requestId,
            'query granularity "parcel" is not allowed'
          );
        }

        let rows: ParcelRow[] = [];
        try {
          rows = await lookupParcelsByIds(parsed.data.parcelIds, parsed.data.includeGeometry);
        } catch (error) {
          return postgisQueryFailed(honoContext, requestId, error);
        }

        let features: ParcelsFeatureCollection["features"];
        try {
          features = mapParcelRowsToFeatures(rows);
        } catch (error) {
          return parcelMappingFailed(honoContext, requestId, error);
        }

        const responseWarnings = profileMetadataWarnings(parsed.data.profile);
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
            profile: parsed.data.profile,
            includeGeometry: parsed.data.includeGeometry,
            recordCount: features.length,
            truncated: false,
            warnings: responseWarnings,
            nextCursor: null,
            ingestionRunId: readIngestionRunId(features),
          }),
        };

        return jsonOk(honoContext, ParcelsFeatureCollectionSchema, payload, requestId);
      })
    )
  );
}
