import { ApiQueryDefaults, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import { type ParcelDetailResponse, ParcelDetailResponseSchema } from "@map-migration/http-contracts/parcels-http";
import type { Context, Env, Hono } from "hono";
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
import { jsonError, jsonOk } from "@/http/api-response";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

function isResponseLike(value: unknown): value is Response {
  if (typeof Response !== "undefined" && value instanceof Response) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    typeof Reflect.get(value, "status") === "number" &&
    typeof Reflect.get(value, "headers") === "object"
  );
}

async function readParcelDetailFeature(args: {
  readonly includeGeometry: NonNullable<ReturnType<typeof parseIncludeGeometryParam>>;
  readonly parcelId: string;
  readonly requestId: string;
  readonly honoContext: Context;
}): Promise<ParcelDetailResponse["feature"] | Response> {
  let rows: ParcelRow[] = [];
  try {
    rows = await getParcelById(args.parcelId, args.includeGeometry);
  } catch (error) {
    return postgisQueryFailed(args.honoContext, args.requestId, error);
  }

  const row = rows[0];
  if (typeof row === "undefined") {
    return jsonError(args.honoContext, {
      requestId: args.requestId,
      httpStatus: 404,
      code: "PARCEL_NOT_FOUND",
      message: "parcel not found",
    });
  }

  try {
    const feature = mapParcelRowToFeature(row);
    return (
      feature ??
      jsonError(args.honoContext, {
        requestId: args.requestId,
        httpStatus: 500,
        code: "PARCEL_MAPPING_FAILED",
        message: "parcel mapping failed",
      })
    );
  } catch (error) {
    return parcelMappingFailed(args.honoContext, args.requestId, error);
  }
}

export function registerParcelDetailRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.parcels}/:parcel-id`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const expectedIngestionRunId = readExpectedIngestionRunId(honoContext);

        if (!isDatasetQueryAllowed("parcels", "parcel")) {
          return rejectWithPolicyError(
            honoContext,
            requestId,
            'query granularity "parcel" is not allowed'
          );
        }

        const parcelId = honoContext.req.param("parcel-id").trim();
        if (parcelId.length === 0) {
          return rejectWithBadRequest(honoContext, requestId, "parcel-id path param is required");
        }

        const includeGeometry = parseIncludeGeometryParam(
          honoContext.req.query("includeGeometry"),
          ApiQueryDefaults.parcelDetail.includeGeometry
        );
        if (includeGeometry === null) {
          return rejectWithBadRequest(
            honoContext,
            requestId,
            "includeGeometry query param must be one of: none, centroid, simplified, full"
          );
        }

        const profile = parseProfileParam(
          honoContext.req.query("profile"),
          ApiQueryDefaults.parcelDetail.profile
        );
        if (profile === null) {
          return rejectWithBadRequest(
            honoContext,
            requestId,
            "profile query param must be one of: analysis_v1, full_170"
          );
        }

        const featureOrResponse = await readParcelDetailFeature({
          honoContext,
          includeGeometry,
          parcelId,
          requestId,
        });
        if (isResponseLike(featureOrResponse)) {
          return featureOrResponse;
        }

        const conflictResponse = conflictResponseIfNeeded(
          honoContext,
          requestId,
          expectedIngestionRunId,
          featureOrResponse.lineage.ingestionRunId ?? undefined,
          1
        );
        if (conflictResponse) {
          return conflictResponse;
        }

        const payload: ParcelDetailResponse = {
          feature: featureOrResponse,
          meta: buildParcelMeta({
            requestId,
            profile,
            includeGeometry,
            recordCount: 1,
            truncated: false,
            warnings: profileMetadataWarnings(profile),
            nextCursor: null,
            ingestionRunId: featureOrResponse.lineage.ingestionRunId ?? undefined,
          }),
        };

        return jsonOk(honoContext, ParcelDetailResponseSchema, payload, requestId);
      })
    )
  );
}
