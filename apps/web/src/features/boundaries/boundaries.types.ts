import type { BoundaryPowerFeature, BoundaryPowerLevel } from "@map-migration/http-contracts";
import type { LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type BoundaryLayerId = BoundaryPowerLevel;

export interface BoundaryFacetOption {
  readonly commissionedPowerMw: number;
  readonly parentRegionName: string | null;
  readonly regionId: string;
  readonly regionName: string;
}

export interface BoundaryHoverState {
  readonly boundaryId: BoundaryLayerId;
  readonly commissionedPowerMw: number;
  readonly parentRegionName: string | null;
  readonly regionId: string;
  readonly regionName: string;
  readonly screenPoint: readonly [number, number];
}

export interface BoundaryLayerOptions {
  readonly isInteractionEnabled?: () => boolean;
  readonly layerId: BoundaryLayerId;
  readonly onFacetOptionsChange?: (
    layerId: BoundaryLayerId,
    options: readonly BoundaryFacetOption[]
  ) => void;
  readonly onHoverChange?: (nextHover: BoundaryHoverState | null) => void;
}

export interface BoundaryLayerController extends LayerVisibilityController {
  clearHover(): void;
  setIncludedRegionIds(regionIds: readonly string[] | null): void;
}

export interface BoundaryLayerState {
  allFeatures: readonly BoundaryPowerFeature[];
  basemapLayersSuppressed: boolean;
  dataLoaded: boolean;
  hoveredFeatureId: number | string | null;
  includedRegionIds: readonly string[] | null;
  ready: boolean;
  requestSequence: number;
  visible: boolean;
}

export interface BoundarySourceData {
  readonly features: readonly unknown[];
  readonly type: "FeatureCollection";
}
