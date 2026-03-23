import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { LayerId } from "@map-migration/map-layer-catalog";
import type {
  MapInteractionCoordinator,
  MapInteractionType,
} from "@/features/app/interaction/map-interaction.types";

export interface FacilitiesViewportRequestContext {
  readonly activeViewMode: FacilitiesViewMode;
  readonly interactionType: MapInteractionType;
  readonly viewportKey: string;
  readonly zoomBucket: number;
}

export interface FacilitiesBboxRequest {
  readonly bbox: BBox;
  readonly datasetVersion?: string;
  limit?: number;
  readonly perspective: FacilityPerspective;
  readonly requestContext?: FacilitiesViewportRequestContext;
}

export type FacilitiesHiddenReason = "stress" | "viewport-span" | "zoom";

export type FacilitiesDegradedReason = "display-budget" | "feature-budget";

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
      readonly perspective: FacilityPerspective;
      readonly state: "hidden";
      readonly reason: FacilitiesHiddenReason;
      readonly maxViewportWidthKm?: number;
      readonly minZoom?: number;
      readonly viewportWidthKm?: number;
      readonly zoom?: number;
    }
  | {
      readonly state: "loading";
      readonly perspective: FacilityPerspective;
    }
  | {
      readonly state: "degraded";
      readonly perspective: FacilityPerspective;
      readonly requestId: string;
      readonly count: number;
      readonly truncated: boolean;
      readonly reason: FacilitiesDegradedReason;
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
  readonly iconMaxViewportFeatures?: number;
  readonly iconMinZoom?: number;
  readonly initialViewMode?: FacilitiesViewMode;
  readonly interactionCoordinator?: MapInteractionCoordinator | null;
  readonly isInteractionEnabled?: () => boolean;
  readonly layerId?: LayerId;
  limit?: number;
  readonly maxViewportFeatureBudget?: number;
  readonly maxViewportWidthKm?: number;
  minZoom?: number;
  readonly onCachedFeaturesUpdate?: (features: FacilitiesFeatureCollection["features"]) => void;
  readonly onClusterClick?: () => void;
  readonly onSelectFacility?: (facility: SelectedFacilityRef | null) => void;
  readonly onStatus?: (status: FacilitiesStatus) => void;
  readonly onStressBlockedChange?: (blocked: boolean) => void;
  readonly onViewportUpdate?: (snapshot: FacilitiesViewportSnapshot) => void;
  perspective?: FacilityPerspective;
}

export type FacilitiesViewMode = "bubbles" | "clusters" | "dots" | "heatmap" | "icons";

export interface FacilitiesLayerController {
  applyFilter(): void;
  clearSelection(): void;
  destroy(): void;
  readonly perspective: FacilityPerspective;
  resolveFeatureProperties(featureId: number | string): unknown | null;
  setViewMode(mode: FacilitiesViewMode): void;
  setVisible(visible: boolean): void;
  zoomToCluster(clusterId: number, center: [number, number]): void;
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
  stressBlocked: boolean;
  viewMode: FacilitiesViewMode;
  visible: boolean;
}

export interface FacilitiesSourceData {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly type: "FeatureCollection";
}

export interface FacilitiesGuardrailResult {
  readonly blocked: boolean;
  readonly reason: Exclude<FacilitiesHiddenReason, "zoom"> | null;
  readonly viewportWidthKm: number;
}
