import type {
  MarketBoundaryFeature,
  MarketBoundaryLevel,
} from "@map-migration/http-contracts/market-boundaries-http";
import type { LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type MarketBoundaryLayerId = MarketBoundaryLevel;

export type MarketBoundaryColorMode = "power" | "vacancy" | "absorption";

export interface MarketBoundaryFacetOption {
  readonly absorption: number | null;
  readonly commissionedPowerMw: number | null;
  readonly marketId: string;
  readonly parentRegionName: string | null;
  readonly regionId: string;
  readonly regionName: string;
  readonly vacancy: number | null;
}

export interface MarketBoundaryHoverState {
  readonly absorption: number | null;
  readonly commissionedPowerMw: number | null;
  readonly layerId: MarketBoundaryLayerId;
  readonly parentRegionName: string | null;
  readonly regionId: string;
  readonly regionName: string;
  readonly screenPoint: readonly [number, number];
  readonly vacancy: number | null;
}

export interface MarketBoundaryLayerOptions {
  readonly colorMode?: MarketBoundaryColorMode;
  readonly isInteractionEnabled?: () => boolean;
  readonly layerId: MarketBoundaryLayerId;
  readonly onFacetOptionsChange?: (
    layerId: MarketBoundaryLayerId,
    options: readonly MarketBoundaryFacetOption[]
  ) => void;
  readonly onHoverChange?: (nextHover: MarketBoundaryHoverState | null) => void;
}

export interface MarketBoundaryLayerController extends LayerVisibilityController {
  clearHover(): void;
  setColorMode(colorMode: MarketBoundaryColorMode): void;
  setIncludedRegionIds(regionIds: readonly string[] | null): void;
}

export interface MarketBoundaryLayerState {
  allFeatures: readonly MarketBoundaryFeature[];
  colorMode: MarketBoundaryColorMode;
  dataLoaded: boolean;
  includedRegionIds: readonly string[] | null;
  ready: boolean;
  requestSequence: number;
  visible: boolean;
}

export interface MarketBoundarySourceData {
  readonly features: readonly unknown[];
  readonly type: "FeatureCollection";
}
