import {
  type ApiEffectError,
  type ApiEffectSuccess,
  apiRequestJsonEffect,
} from "@map-migration/core-runtime/api";
import { buildParcelEnrichRoute } from "@map-migration/http-contracts/api-routes";
import {
  type ParcelEnrichRequest,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/http-contracts/parcels-http";
import type { Effect } from "effect";
import type { FetchParcelsBySelectionOptions } from "@/features/measure/measure-analysis.api.types";
import {
  buildJsonPostRequestInit,
  withParcelIngestionRunIdHeader,
} from "@/lib/api/api-request-init.service";

export type { ParcelsSelectionResult } from "@/features/measure/measure-analysis.api.types";

function buildParcelsSelectionRequestInit(
  request: ParcelEnrichRequest,
  signal?: AbortSignal,
  options: FetchParcelsBySelectionOptions = {}
): RequestInit {
  return withParcelIngestionRunIdHeader(
    buildJsonPostRequestInit({
      body: request,
      signal,
    }),
    options.expectedIngestionRunId
  );
}

export function fetchParcelsBySelectionEffect(
  request: ParcelEnrichRequest,
  signal?: AbortSignal,
  options: FetchParcelsBySelectionOptions = {}
): Effect.Effect<ApiEffectSuccess<ParcelsFeatureCollection>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildParcelEnrichRoute(),
    ParcelsFeatureCollectionSchema,
    buildParcelsSelectionRequestInit(request, signal, options)
  );
}
