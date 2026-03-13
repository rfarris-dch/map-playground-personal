import type {
  BBox,
  FacilitiesFeatureCollection,
  FacilityPerspective,
} from "@map-migration/contracts";

export interface FacilitiesBboxRequest {
  readonly bbox: BBox;
  limit?: number;
  readonly perspective: FacilityPerspective;
}

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

export type FacilitiesFeatureFilterPredicate = (
  feature: FacilitiesFeatureCollection["features"][number]
) => boolean;

export interface FacilitiesLayerOptions {
  debounceMs?: number;
  readonly filterPredicate?: () => FacilitiesFeatureFilterPredicate | null;
  readonly isInteractionEnabled?: () => boolean;
  limit?: number;
  minZoom?: number;
  readonly onCachedFeaturesUpdate?: (features: FacilitiesFeatureCollection["features"]) => void;
  readonly onSelectFacility?: (facility: SelectedFacilityRef | null) => void;
  readonly onStatus?: (status: FacilitiesStatus) => void;
  readonly onViewportUpdate?: (snapshot: FacilitiesViewportSnapshot) => void;
  perspective?: FacilityPerspective;
}

export type FacilitiesViewMode = "bubbles" | "clusters" | "dots" | "heatmap" | "icons";

export interface FacilitiesLayerController {
  applyFilter(): void;
  clearSelection(): void;
  destroy(): void;
  readonly perspective: FacilityPerspective;
  setViewMode(mode: FacilitiesViewMode): void;
  setVisible(visible: boolean): void;
}

export interface FacilitiesLayerState {
  cachedFeatures: FacilitiesFeatureCollection["features"];
  debounceTimer: number | null;
  fetchedBbox: BBox | null;
  lastFetchKey: string | null;
  lastRequestId: string | null;
  lastTruncated: boolean;
  ready: boolean;
  requestSequence: number;
  selectedFeatureId: number | string | null;
  viewMode: FacilitiesViewMode;
  visible: boolean;
}

export interface FacilitiesSourceData {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly type: "FeatureCollection";
}
