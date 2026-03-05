import type {
  BBox,
  FacilitiesFeatureCollection,
  FacilityPerspective,
} from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export interface FacilitiesBboxRequest {
  readonly bbox: BBox;
  limit?: number;
  readonly perspective: FacilityPerspective;
  signal?: AbortSignal;
}

export type FacilitiesFetchResult = ApiResult<FacilitiesFeatureCollection>;

export interface FacilitiesViewportSnapshot {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly perspective: FacilityPerspective;
  readonly requestId: string;
  readonly truncated: boolean;
}

export interface SelectedFacilityRef {
  readonly facilityId: string;
  readonly perspective: FacilityPerspective;
}

export type FacilitiesStatus =
  | { readonly state: "idle" }
  | {
      readonly state: "hidden";
      readonly minZoom: number;
      readonly zoom: number;
    }
  | {
      readonly state: "loading";
      readonly perspective: FacilityPerspective;
    }
  | {
      readonly state: "ok";
      readonly perspective: FacilityPerspective;
      readonly requestId: string;
      readonly count: number;
      readonly truncated: boolean;
    }
  | {
      readonly state: "error";
      readonly perspective: FacilityPerspective;
      readonly requestId: string;
      readonly reason: string;
    };

export interface FacilitiesLayerOptions {
  debounceMs?: number;
  readonly isInteractionEnabled?: () => boolean;
  limit?: number;
  minZoom?: number;
  readonly onSelectFacility?: (facility: SelectedFacilityRef | null) => void;
  readonly onStatus?: (status: FacilitiesStatus) => void;
  readonly onViewportUpdate?: (snapshot: FacilitiesViewportSnapshot) => void;
  perspective?: FacilityPerspective;
}

export interface FacilitiesLayerController {
  clearSelection(): void;
  destroy(): void;
  readonly perspective: FacilityPerspective;
  setVisible(visible: boolean): void;
}

export interface FacilitiesLayerState {
  abortController: AbortController | null;
  debounceTimer: number | null;
  lastFetchKey: string | null;
  ready: boolean;
  requestSequence: number;
  selectedFeatureId: number | string | null;
  visible: boolean;
}

export interface FacilitiesSourceData {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly type: "FeatureCollection";
}
