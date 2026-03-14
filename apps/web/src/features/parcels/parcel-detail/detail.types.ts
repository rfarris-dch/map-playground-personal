import type { ParcelDetailResponse, ParcelGeometryMode, ParcelProfile } from "@map-migration/http-contracts";
import type { ApiResult } from "@map-migration/core-runtime/api";
import type { SelectedParcelRef } from "@/features/parcels/parcels.types";

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

export type ParcelDetailQueryKey = readonly ["parcel-detail", string | null, string | null];
