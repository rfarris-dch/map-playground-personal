import type {
  ParcelDetailResponse,
  ParcelGeometryMode,
  ParcelProfile,
} from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";
import type { SelectedParcelRef } from "../parcels.types";

export interface ParcelDetailRequest extends SelectedParcelRef {
  readonly includeGeometry?: ParcelGeometryMode;
  readonly profile?: ParcelProfile;
  readonly signal?: AbortSignal;
}

export type ParcelDetailResult = ApiResult<ParcelDetailResponse>;

export interface ParcelDetailPayload {
  readonly requestId: string;
  readonly response: ParcelDetailResponse;
}
