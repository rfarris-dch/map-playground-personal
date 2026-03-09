import {
  ApiHeaders,
  buildFacilitiesSelectionRoute,
  buildParcelEnrichRoute,
  type FacilitiesSelectionRequest,
  type FacilitiesSelectionResponse,
  FacilitiesSelectionResponseSchema,
  type ParcelEnrichRequest,
  type ParcelsFeatureCollection,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/contracts";
import {
  type ApiEffectError,
  type ApiEffectSuccess,
  apiGetJson,
  apiGetJsonEffect,
} from "@map-migration/core-runtime/api";
import type { Effect } from "effect";
import type {
  FacilitiesSelectionResult,
  FetchParcelsBySelectionOptions,
  ParcelsSelectionResult,
} from "@/features/measure/measure-analysis.api.types";

export type {
  FacilitiesSelectionResult,
  ParcelsSelectionResult,
} from "@/features/measure/measure-analysis.api.types";

export function fetchFacilitiesBySelection(
  request: FacilitiesSelectionRequest,
  signal?: AbortSignal
): Promise<FacilitiesSelectionResult> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  };

  if (signal) {
    requestInit.signal = signal;
  }

  return apiGetJson(
    buildFacilitiesSelectionRoute(),
    FacilitiesSelectionResponseSchema,
    requestInit
  );
}

export function fetchFacilitiesBySelectionEffect(
  request: FacilitiesSelectionRequest,
  signal?: AbortSignal
): Effect.Effect<ApiEffectSuccess<FacilitiesSelectionResponse>, ApiEffectError, never> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  };

  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  return apiGetJsonEffect(
    buildFacilitiesSelectionRoute(),
    FacilitiesSelectionResponseSchema,
    requestInit
  );
}

export function fetchParcelsBySelection(
  request: ParcelEnrichRequest,
  signal?: AbortSignal,
  options: FetchParcelsBySelectionOptions = {}
): Promise<ParcelsSelectionResult> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  };

  if (signal) {
    requestInit.signal = signal;
  }

  if (
    typeof options.expectedIngestionRunId === "string" &&
    options.expectedIngestionRunId.trim().length > 0
  ) {
    requestInit.headers = {
      ...requestInit.headers,
      [ApiHeaders.parcelIngestionRunId]: options.expectedIngestionRunId.trim(),
    };
  }

  return apiGetJson(buildParcelEnrichRoute(), ParcelsFeatureCollectionSchema, requestInit);
}

export function fetchParcelsBySelectionEffect(
  request: ParcelEnrichRequest,
  signal?: AbortSignal,
  options: FetchParcelsBySelectionOptions = {}
): Effect.Effect<ApiEffectSuccess<ParcelsFeatureCollection>, ApiEffectError, never> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  };

  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  if (
    typeof options.expectedIngestionRunId === "string" &&
    options.expectedIngestionRunId.trim().length > 0
  ) {
    requestInit.headers = {
      ...requestInit.headers,
      [ApiHeaders.parcelIngestionRunId]: options.expectedIngestionRunId.trim(),
    };
  }

  return apiGetJsonEffect(buildParcelEnrichRoute(), ParcelsFeatureCollectionSchema, requestInit);
}
