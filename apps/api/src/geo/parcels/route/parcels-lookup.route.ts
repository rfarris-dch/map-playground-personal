import {
  ApiRoutes,
  ParcelLookupRequestSchema,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/contracts";
import type { Hono } from "hono";
import { getOrCreateRequestId, jsonOk } from "../../../http/api-response";
import { mapParcelRowsToFeatures } from "../parcels.mapper";
import { lookupParcelsByIds, type ParcelRow } from "../parcels.repo";
import {
  parcelMappingFailed,
  postgisQueryFailed,
  rejectWithBadRequest,
} from "./parcels-route-errors.service";
import {
  buildParcelMeta,
  conflictResponseIfNeeded,
  profileMetadataWarnings,
  readExpectedIngestionRunId,
  readIngestionRunId,
} from "./parcels-route-meta.service";

export function registerParcelsLookupRoute(app: Hono): void {
  app.post(`${ApiRoutes.parcels}/lookup`, async (c) => {
    const requestId = getOrCreateRequestId(c, "api");
    const expectedIngestionRunId = readExpectedIngestionRunId(c);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return rejectWithBadRequest(c, requestId, "invalid JSON body");
    }

    const parsed = ParcelLookupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return rejectWithBadRequest(c, requestId, "invalid parcel lookup request payload");
    }

    let rows: ParcelRow[] = [];
    try {
      rows = await lookupParcelsByIds(parsed.data.parcelIds, parsed.data.includeGeometry);
    } catch (error) {
      return postgisQueryFailed(c, requestId, error);
    }

    let features: ParcelsFeatureCollection["features"];
    try {
      features = mapParcelRowsToFeatures(rows);
    } catch (error) {
      return parcelMappingFailed(c, requestId, error);
    }

    const responseWarnings = profileMetadataWarnings(parsed.data.profile);
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
        recordCount: features.length,
        truncated: false,
        warnings: responseWarnings,
        nextCursor: null,
        ingestionRunId: readIngestionRunId(features),
      }),
    };

    return jsonOk(c, ParcelsFeatureCollectionSchema, payload, requestId);
  });
}
