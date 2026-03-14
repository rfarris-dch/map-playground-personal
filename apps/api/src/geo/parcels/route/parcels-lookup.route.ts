import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  ParcelLookupRequestSchema,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/http-contracts/parcels-http";
import type { Env, Hono } from "hono";
import { lookupParcelFeatures } from "@/geo/parcels/parcels-query.service";
import { buildParcelMeta, readIngestionRunId } from "@/geo/parcels/parcels-response-meta.service";
import {
  parcelMappingFailed,
  postgisQueryFailed,
  rejectWithBadRequest,
  rejectWithPolicyError,
} from "@/geo/parcels/route/parcels-route-errors.service";
import {
  readExpectedIngestionRunId,
  throwIfIngestionRunConflict,
} from "@/geo/parcels/route/parcels-route-meta.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";
import { readJsonBody } from "@/http/json-request.service";
import { registerRouteTimeoutProfile } from "@/http/route-timeout-profile.service";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

export function registerParcelsLookupRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(`${ApiRoutes.parcels}/lookup`, "parcels");

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
          throw rejectWithBadRequest("invalid parcel lookup request payload");
        }

        if (!isDatasetQueryAllowed("parcels", "parcel")) {
          throw rejectWithPolicyError('query granularity "parcel" is not allowed');
        }

        if (parsed.data.includeGeometry === "full" && parsed.data.parcelIds.length > 100) {
          throw rejectWithPolicyError(
            'includeGeometry "full" is not allowed when requesting more than 100 parcels'
          );
        }

        const queryResult = await lookupParcelFeatures({
          includeGeometry: parsed.data.includeGeometry,
          parcelIds: parsed.data.parcelIds,
        });
        if (!queryResult.ok) {
          throw queryResult.value.reason === "mapping_failed"
            ? parcelMappingFailed(queryResult.value.error)
            : postgisQueryFailed(queryResult.value.error);
        }

        const features: ParcelsFeatureCollection["features"] = queryResult.value.features;
        const actualIngestionRunId = readIngestionRunId(features);
        throwIfIngestionRunConflict(expectedIngestionRunId, actualIngestionRunId, features.length);

        const payload: ParcelsFeatureCollection = {
          type: "FeatureCollection",
          features,
          meta: buildParcelMeta({
            requestId,
            profile: parsed.data.profile,
            includeGeometry: parsed.data.includeGeometry,
            recordCount: features.length,
            truncated: false,
            warnings: [],
            nextCursor: null,
            ingestionRunId: readIngestionRunId(features),
          }),
        };

        return jsonOk(honoContext, ParcelsFeatureCollectionSchema, payload, requestId);
      })
    )
  );
}
