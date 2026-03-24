import type {
  CountyPowerStoryGeometryResponse,
  CountyPowerStoryId as CountyPowerStoryIdType,
  CountyPowerStoryRow,
  CountyPowerStorySnapshotResponse,
  CountyPowerStoryTimelineResponse,
  CountyPowerStoryWindow as CountyPowerStoryWindowType,
} from "@map-migration/http-contracts/county-power-story-http";
import type { LayerStatus, LayerVisibilityController } from "@/features/layers/layer-runtime.types";

export type {
  CountyPowerStoryId,
  CountyPowerStoryWindow,
} from "@map-migration/http-contracts/county-power-story-http";

export type CountyPowerStoryCatalogLayerId =
  | "models.county-power-grid-stress"
  | "models.county-power-queue-pressure"
  | "models.county-power-market-structure"
  | "models.county-power-policy-watch"
  | "models.county-power-3d";

export type CountyPowerStoryVisibleLayerId = Exclude<
  CountyPowerStoryCatalogLayerId,
  "models.county-power-3d"
>;

export type CountyPowerStoryChapterId =
  | "operator-heartbeat"
  | "transfer-friction"
  | "queue-pressure-storm"
  | "transmission-current"
  | "policy-shockwaves"
  | "county-scan";

export interface CountyPowerStoryVisibilityState {
  readonly animationEnabled: boolean;
  readonly chapterId: CountyPowerStoryChapterId;
  readonly chapterVisible: boolean;
  readonly seamHazeEnabled: boolean;
  readonly storyId: CountyPowerStoryIdType;
  readonly threeDimensional: boolean;
  readonly visible: boolean;
  readonly window: CountyPowerStoryWindowType;
}

export interface CountyPowerStoryHoverState {
  readonly row: CountyPowerStoryRow;
  readonly screenPoint: readonly [number, number];
  readonly storyId: CountyPowerStoryIdType;
  readonly window: CountyPowerStoryWindowType;
}

export interface CountyPowerStorySelectionState {
  readonly countyFips: string;
  readonly countyName: string | null;
  readonly stateAbbrev: string | null;
  readonly storyId: CountyPowerStoryIdType;
  readonly window: CountyPowerStoryWindowType;
}

export interface CountyPowerStoryLayerVisibilityController extends LayerVisibilityController {
  readonly layerId: CountyPowerStoryCatalogLayerId;
}

export interface CountyPowerStoryRuntimeController {
  destroy(): void;
  setAnimationEnabled(enabled: boolean): void;
  setChapterId(chapterId: CountyPowerStoryChapterId): Promise<void>;
  setChapterVisible(visible: boolean): Promise<void>;
  setSeamHazeEnabled(enabled: boolean): void;
  setSelectedCounty(countyFips: string | null): void;
  setStoryId(storyId: CountyPowerStoryIdType): Promise<void>;
  setThreeDimensionalEnabled(enabled: boolean): void;
  setVisibilityManagedByRuntime(enabled: boolean): void;
  setVisible(visible: boolean): Promise<void>;
  setWindow(window: CountyPowerStoryWindowType): Promise<void>;
}

export interface CountyPowerStoryMountResult {
  readonly controller: CountyPowerStoryRuntimeController;
  readonly controllers: Readonly<
    Record<CountyPowerStoryCatalogLayerId, CountyPowerStoryLayerVisibilityController>
  >;
  destroy(): void;
  readonly status: LayerStatus;
}

export interface CountyPowerStorySelectionDetail {
  readonly row: CountyPowerStoryRow | null;
}

export type CountyPowerStoryGeometryFetchResult =
  import("@map-migration/core-runtime/api").ApiResult<CountyPowerStoryGeometryResponse>;
export type CountyPowerStorySnapshotFetchResult =
  import("@map-migration/core-runtime/api").ApiResult<CountyPowerStorySnapshotResponse>;
export type CountyPowerStoryTimelineFetchResult =
  import("@map-migration/core-runtime/api").ApiResult<CountyPowerStoryTimelineResponse>;
