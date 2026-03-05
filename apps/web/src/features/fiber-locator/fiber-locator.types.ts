import type {
  FiberLocatorCatalogResponse,
  FiberLocatorLayersInViewResponse,
} from "@map-migration/contracts";
import type { IMap } from "@map-migration/map-engine";
import type { ApiResult } from "@/lib/api-client";

export type FiberLocatorLineId = "metro" | "longhaul";

export type FiberLocatorCatalogFetchResult = ApiResult<FiberLocatorCatalogResponse>;
export type FiberLocatorInViewFetchResult = ApiResult<FiberLocatorLayersInViewResponse>;

export type FiberLocatorStatus =
  | { readonly state: "idle" }
  | { readonly state: "loading" }
  | {
      readonly state: "ok";
      readonly count: number;
      readonly requestId: string;
    }
  | {
      readonly state: "error";
      readonly reason: string;
      readonly requestId: string;
    };

export interface FiberLocatorLayerOptions {
  readonly lineId: FiberLocatorLineId;
  readonly map: IMap;
  readonly opacity?: number;
  readonly sourceLayers?: readonly FiberLocatorSourceLayerOption[];
}

export interface FiberLocatorSourceLayerOption {
  readonly color: string | null;
  readonly label: string;
  readonly layerName: string;
}

export interface FiberLocatorLayerController {
  destroy(): void;
  getLayerIds(): readonly string[];
  getSourceId(): string;
  readonly lineId: FiberLocatorLineId;
  setSourceLayers(sourceLayers: readonly FiberLocatorSourceLayerOption[]): void;
  setVisible(visible: boolean): void;
}

export interface FiberLocatorLayerState {
  layerIds: Set<string>;
  ready: boolean;
  sourceLayers: readonly FiberLocatorSourceLayerOption[];
  visible: boolean;
}
