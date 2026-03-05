import {
  ApiHeaders,
  buildParcelDetailRoute,
  ParcelDetailResponseSchema,
  type ParcelGeometryMode,
  type ParcelProfile,
} from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { ParcelDetailRequest, ParcelDetailResult } from "./detail.types";

const DEFAULT_PROFILE: ParcelProfile = "full_170";
const DEFAULT_GEOMETRY_MODE: ParcelGeometryMode = "full";

export function fetchParcelDetail(request: ParcelDetailRequest): Promise<ParcelDetailResult> {
  const params = new URLSearchParams();
  params.set("profile", request.profile ?? DEFAULT_PROFILE);
  params.set("includeGeometry", request.includeGeometry ?? DEFAULT_GEOMETRY_MODE);

  const requestInit: RequestInit = {};
  if (
    typeof request.expectedIngestionRunId === "string" &&
    request.expectedIngestionRunId.trim().length > 0
  ) {
    requestInit.headers = {
      [ApiHeaders.parcelIngestionRunId]: request.expectedIngestionRunId.trim(),
    };
  }

  if (request.signal) {
    requestInit.signal = request.signal;
  }

  const url = `${buildParcelDetailRoute(request.parcelId)}?${params.toString()}`;
  return apiGetJson(url, ParcelDetailResponseSchema, requestInit);
}
