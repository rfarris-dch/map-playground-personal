import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  FacilitiesDetailResponse,
  FacilitiesFeatureCollection,
  FacilitiesSelectionRequest,
  FacilitiesSelectionResponse,
} from "@map-migration/http-contracts/facilities-http";

export type FacilitiesCacheStatus = "miss" | "redis-hit" | "stale";

export interface FacilitiesBboxCacheBody {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly truncated: boolean;
  readonly warnings: FacilitiesFeatureCollection["meta"]["warnings"];
}

export interface FacilitiesDetailCacheBody {
  readonly feature: FacilitiesDetailResponse["feature"];
}

export interface FacilitiesSelectionCacheBody {
  readonly features: FacilitiesSelectionResponse["features"];
  readonly selection: FacilitiesSelectionResponse["selection"];
  readonly truncated: boolean;
  readonly warnings: FacilitiesSelectionResponse["meta"]["warnings"];
}

export interface FacilitiesCacheEntry<TPayload> {
  readonly dataVersion: string;
  readonly etag: string;
  readonly freshUntilEpochMs: number;
  readonly generatedAt: string;
  readonly originRequestId: string;
  readonly payload: TPayload;
}

export interface FacilitiesBboxCacheKeyArgs {
  readonly bbox: {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
  };
  readonly dataVersion: string;
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}

export interface FacilitiesDetailCacheKeyArgs {
  readonly dataVersion: string;
  readonly facilityId: string;
  readonly perspective: FacilityPerspective;
}

export interface FacilitiesSelectionCacheKeyArgs {
  readonly dataVersion: string;
  readonly geometry: FacilitiesSelectionRequest["geometry"];
  readonly limitPerPerspective: number;
  readonly perspectives: readonly FacilityPerspective[];
}

export interface FacilitiesCacheHeaders {
  readonly cacheStatus: FacilitiesCacheStatus;
  readonly dataVersion: string;
  readonly etag: string;
  readonly originRequestId: string;
}
