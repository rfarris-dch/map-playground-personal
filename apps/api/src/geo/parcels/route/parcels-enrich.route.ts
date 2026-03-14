import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type ParcelEnrichRequest,
  ParcelEnrichRequestSchema,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/http-contracts/parcels-http";
import type { Context, Env, Hono } from "hono";
import {
  coerceCursor,
  paginateEnrichFeatures,
  resolvePageSize,
} from "@/geo/parcels/parcels-pagination.service";
import { queryParcelFeaturesByAoi } from "@/geo/parcels/parcels-query.service";
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

async function readParcelsEnrichRequest(
  c: Context,
  requestId: string
): Promise<ParcelEnrichRequest | Response> {
  const bodyResult = await readJsonBody(c, {
    requestId,
    invalidJsonMessage: "invalid JSON body",
  });
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = ParcelEnrichRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    throw rejectWithBadRequest("invalid parcel enrich request payload");
  }

  return parsed.data;
}

export function registerParcelsEnrichRoute<E extends Env>(app: Hono<E>): void {
  registerRouteTimeoutProfile(`${ApiRoutes.parcels}/enrich`, "parcels");

  app.post(`${ApiRoutes.parcels}/enrich`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const expectedIngestionRunId = readExpectedIngestionRunId(honoContext);
        const requestOrResponse = await readParcelsEnrichRequest(honoContext, requestId);
        if (requestOrResponse instanceof Response) {
          return requestOrResponse;
        }
        const request = requestOrResponse;

        if (!isDatasetQueryAllowed("parcels", request.aoi.type)) {
          throw rejectWithPolicyError(
            `query granularity "${request.aoi.type}" is not allowed for parcels`
          );
        }

        const pageSizeResolution = resolvePageSize(request.pageSize);
        const warnings = pageSizeResolution.warnings;
        const pageSize = pageSizeResolution.pageSize;

        const cursor = coerceCursor(request.cursor);
        const queryLimit = pageSize + 1;

        const queryResult = await queryParcelFeaturesByAoi({
          aoi: request.aoi,
          cursor,
          includeGeometry: request.includeGeometry,
          queryLimit,
        });
        if (!queryResult.ok) {
          if (queryResult.value.reason === "policy_rejected") {
            throw rejectWithPolicyError(queryResult.value.message);
          }

          throw queryResult.value.reason === "mapping_failed"
            ? parcelMappingFailed(queryResult.value.error)
            : postgisQueryFailed(queryResult.value.error);
        }

        const featuresBeforePagination: ParcelsFeatureCollection["features"] =
          queryResult.value.features;
        const paginated = paginateEnrichFeatures(featuresBeforePagination, pageSize, warnings);
        const features = paginated.features;
        const hasMore = paginated.hasMore;
        const responseWarnings = [...queryResult.value.warnings, ...warnings];
        const actualIngestionRunId = readIngestionRunId(features);
        throwIfIngestionRunConflict(expectedIngestionRunId, actualIngestionRunId, features.length);

        const payload: ParcelsFeatureCollection = {
          type: "FeatureCollection",
          features,
          meta: buildParcelMeta({
            requestId,
            profile: request.profile,
            includeGeometry: request.includeGeometry,
            aoiType: request.aoi.type,
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
