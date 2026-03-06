import {
  ApiHeaders,
  buildFacilitiesSelectionRoute,
  buildParcelEnrichRoute,
  type FacilitiesSelectionRequest,
  FacilitiesSelectionResponseSchema,
  type ParcelEnrichRequest,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/contracts";
import type {
  FacilitiesSelectionResult,
  FetchParcelsBySelectionOptions,
  ParcelsSelectionResult,
} from "@/features/measure/measure-analysis.api.types";
import { apiGetJson } from "@/lib/api-client";

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
