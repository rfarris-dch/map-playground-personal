import {
  buildFacilitiesSelectionRoute,
  buildParcelEnrichRoute,
  type FacilitiesSelectionRequest,
  FacilitiesSelectionResponseSchema,
  type ParcelEnrichRequest,
  ParcelsFeatureCollectionSchema,
} from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type {
  FacilitiesSelectionResult,
  ParcelsSelectionResult,
} from "./measure-analysis.api.types";

export type {
  FacilitiesSelectionResult,
  ParcelsSelectionResult,
} from "./measure-analysis.api.types";

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
  signal?: AbortSignal
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

  return apiGetJson(buildParcelEnrichRoute(), ParcelsFeatureCollectionSchema, requestInit);
}
