import {
  type ApiEffectError,
  type ApiEffectSuccess,
  apiGetJson,
  apiGetJsonEffect,
} from "@map-migration/core-runtime/api";
import {
  buildFacilitiesSelectionRoute,
  buildParcelEnrichRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  type FacilitiesSelectionRequest,
  type FacilitiesSelectionResponse,
  FacilitiesSelectionResponseSchema,
} from "@map-migration/http-contracts/facilities-http";
import {
  type ParcelEnrichRequest,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/http-contracts/parcels-http";
import type { Effect } from "effect";
import type {
  FacilitiesSelectionResult,
  FetchParcelsBySelectionOptions,
  ParcelsSelectionResult,
} from "@/features/measure/measure-analysis.api.types";
import {
  buildJsonPostRequestInit,
  withParcelIngestionRunIdHeader,
} from "@/lib/api/api-request-init.service";

export type {
  FacilitiesSelectionResult,
  ParcelsSelectionResult,
} from "@/features/measure/measure-analysis.api.types";

function buildFacilitiesSelectionRequestInit(
  request: FacilitiesSelectionRequest,
  signal?: AbortSignal
): RequestInit {
  return buildJsonPostRequestInit({
    body: request,
    signal,
  });
}

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

export function fetchFacilitiesBySelection(
  request: FacilitiesSelectionRequest,
  signal?: AbortSignal
): Promise<FacilitiesSelectionResult> {
  return apiGetJson(
    buildFacilitiesSelectionRoute(),
    FacilitiesSelectionResponseSchema,
    buildFacilitiesSelectionRequestInit(request, signal)
  );
}

export function fetchFacilitiesBySelectionEffect(
  request: FacilitiesSelectionRequest,
  signal?: AbortSignal
): Effect.Effect<ApiEffectSuccess<FacilitiesSelectionResponse>, ApiEffectError, never> {
  return apiGetJsonEffect(
    buildFacilitiesSelectionRoute(),
    FacilitiesSelectionResponseSchema,
    buildFacilitiesSelectionRequestInit(request, signal)
  );
}

export function fetchParcelsBySelection(
  request: ParcelEnrichRequest,
  signal?: AbortSignal,
  options: FetchParcelsBySelectionOptions = {}
): Promise<ParcelsSelectionResult> {
  return apiGetJson(
    buildParcelEnrichRoute(),
    ParcelsFeatureCollectionSchema,
    buildParcelsSelectionRequestInit(request, signal, options)
  );
}

export function fetchParcelsBySelectionEffect(
  request: ParcelEnrichRequest,
  signal?: AbortSignal,
  options: FetchParcelsBySelectionOptions = {}
): Effect.Effect<ApiEffectSuccess<ParcelsFeatureCollection>, ApiEffectError, never> {
  return apiGetJsonEffect(
    buildParcelEnrichRoute(),
    ParcelsFeatureCollectionSchema,
    buildParcelsSelectionRequestInit(request, signal, options)
  );
}
