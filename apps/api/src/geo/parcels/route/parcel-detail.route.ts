import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type ParcelDetailPath,
  ParcelDetailPathSchema,
  type ParcelDetailRequest,
  ParcelDetailRequestSchema,
  type ParcelDetailResponse,
  ParcelDetailResponseSchema,
} from "@map-migration/http-contracts/parcels-http";
import type { Context, Env, Hono } from "hono";
import { queryParcelDetailFeature } from "@/geo/parcels/parcels-query.service";
import { buildParcelMeta } from "@/geo/parcels/parcels-response-meta.service";
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
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";

function readParcelDetailParams(honoContext: Context): {
  readonly includeGeometry: ParcelDetailRequest["includeGeometry"];
  readonly parcelId: ParcelDetailPath["parcelId"];
  readonly profile: ParcelDetailRequest["profile"];
} {
  const path = ParcelDetailPathSchema.safeParse({
    parcelId: honoContext.req.param("parcel-id"),
  });
  if (!path.success) {
    throw rejectWithBadRequest("invalid parcel detail path params");
  }

  const request = ParcelDetailRequestSchema.safeParse({
    includeGeometry: honoContext.req.query("includeGeometry"),
    profile: honoContext.req.query("profile"),
  });
  if (!request.success) {
    throw rejectWithBadRequest("invalid parcel detail request");
  }

  return {
    includeGeometry: request.data.includeGeometry,
    parcelId: path.data.parcelId,
    profile: request.data.profile,
  };
}

function throwParcelDetailFailure(args: {
  readonly error: unknown;
  readonly reason: "mapping_failed" | "not_found" | "query_failed";
}): never {
  if (args.reason === "not_found") {
    throw routeError({
      httpStatus: 404,
      code: "PARCEL_NOT_FOUND",
      message: "parcel not found",
    });
  }

  throw args.reason === "mapping_failed"
    ? parcelMappingFailed(args.error)
    : postgisQueryFailed(args.error);
}

async function handleParcelDetailRequest(args: {
  readonly honoContext: Context;
  readonly requestId: string;
}) {
  const expectedIngestionRunId = readExpectedIngestionRunId(args.honoContext);

  if (!isDatasetQueryAllowed("parcels", "parcel")) {
    throw rejectWithPolicyError('query granularity "parcel" is not allowed');
  }

  const params = readParcelDetailParams(args.honoContext);

  const featureResult = await queryParcelDetailFeature({
    includeGeometry: params.includeGeometry,
    parcelId: params.parcelId,
  });
  if (!featureResult.ok) {
    throwParcelDetailFailure({
      error: featureResult.value.error,
      reason: featureResult.value.reason,
    });
  }

  throwIfIngestionRunConflict(
    expectedIngestionRunId,
    featureResult.value.feature.lineage.ingestionRunId ?? undefined,
    1
  );

  const payload: ParcelDetailResponse = {
    feature: featureResult.value.feature,
    meta: buildParcelMeta({
      requestId: args.requestId,
      profile: params.profile,
      includeGeometry: params.includeGeometry,
      recordCount: 1,
      truncated: false,
      warnings: [],
      nextCursor: null,
      ingestionRunId: featureResult.value.feature.lineage.ingestionRunId ?? undefined,
    }),
  };

  return jsonOk(args.honoContext, ParcelDetailResponseSchema, payload, args.requestId);
}

export function registerParcelDetailRoute<E extends Env>(app: Hono<E>): void {
  app.get(`${ApiRoutes.parcels}/:parcel-id`, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) =>
        handleParcelDetailRequest({ honoContext, requestId })
      )
    )
  );
}
