import {
  DEFAULT_LAYER_CATALOG,
  type LayerCatalog,
  type LayerId,
} from "@map-migration/map-layer-catalog";
import type { MarketBoundaryVisibilityState } from "@/features/app/components/map-layer-controls-panel.types";
import {
  COUNTY_POWER_STORY_3D_LAYER_ID,
  countyPowerStoryLayerId,
  FLOOD_100_LAYER_ID,
  FLOOD_500_LAYER_ID,
  facilitiesLayerId,
  fiberLayerId,
  GAS_PIPELINES_LAYER_ID,
  HYDRO_BASINS_LAYER_ID,
  PARCELS_LAYER_ID,
  powerLayerId,
  WATER_FEATURES_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import type {
  BoundaryVisibilityState,
  FiberVisibilityState,
  FloodVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import { defaultBasemapVisibilityState } from "@/features/basemap/basemap.service";
import type { BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type {
  CountyPowerStoryId,
  CountyPowerStoryVisibilityState,
} from "@/features/county-power-story/county-power-story.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";
import type { PowerLayerId, PowerVisibilityState } from "@/features/power/power.types";

function readCatalogDefaultVisible(
  layerId: keyof LayerCatalog,
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): boolean {
  return catalog[layerId].defaultVisible;
}

function readRuntimeUserVisible(
  runtime: LayerRuntimeController | null,
  layerId: keyof LayerCatalog,
  fallback: boolean
): boolean {
  if (runtime === null) {
    return fallback;
  }

  return runtime.getUserVisible(layerId);
}

function pushLayerIfVisible(visibleLayerIds: LayerId[], layerId: LayerId, visible: boolean): void {
  if (visible) {
    visibleLayerIds.push(layerId);
  }
}

export function buildInitialPerspectiveVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): PerspectiveVisibilityState {
  return {
    colocation: readCatalogDefaultVisible(facilitiesLayerId("colocation"), catalog),
    hyperscale: readCatalogDefaultVisible(facilitiesLayerId("hyperscale"), catalog),
    "hyperscale-leased": readCatalogDefaultVisible(facilitiesLayerId("hyperscale-leased"), catalog),
    enterprise: readCatalogDefaultVisible(facilitiesLayerId("enterprise"), catalog),
  };
}

export function buildInitialBoundaryVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): BoundaryVisibilityState {
  return {
    county: readCatalogDefaultVisible("county", catalog),
    state: readCatalogDefaultVisible("state", catalog),
    country: readCatalogDefaultVisible("country", catalog),
  };
}

export function buildInitialFloodVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): FloodVisibilityState {
  return {
    flood100: readCatalogDefaultVisible(FLOOD_100_LAYER_ID, catalog),
    flood500: readCatalogDefaultVisible(FLOOD_500_LAYER_ID, catalog),
  };
}

export function buildInitialFiberVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): FiberVisibilityState {
  return {
    metro: readCatalogDefaultVisible(fiberLayerId("metro"), catalog),
    longhaul: readCatalogDefaultVisible(fiberLayerId("longhaul"), catalog),
  };
}

export function buildInitialPowerVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): PowerVisibilityState {
  return {
    transmission: readCatalogDefaultVisible(powerLayerId("transmission"), catalog),
    substations: readCatalogDefaultVisible(powerLayerId("substations"), catalog),
    plants: readCatalogDefaultVisible(powerLayerId("plants"), catalog),
  };
}

export function buildInitialCountyPowerStoryVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): CountyPowerStoryVisibilityState {
  return {
    animationEnabled: true,
    chapterId: "operator-heartbeat",
    chapterVisible: true,
    seamHazeEnabled: false,
    storyId: "grid-stress",
    threeDimensional: readCatalogDefaultVisible(COUNTY_POWER_STORY_3D_LAYER_ID, catalog),
    visible: readCatalogDefaultVisible(countyPowerStoryLayerId("grid-stress"), catalog),
    window: "live",
  };
}

export function buildInitialParcelsVisible(catalog: LayerCatalog = DEFAULT_LAYER_CATALOG): boolean {
  return readCatalogDefaultVisible(PARCELS_LAYER_ID, catalog);
}

export function buildInitialWaterVisible(catalog: LayerCatalog = DEFAULT_LAYER_CATALOG): boolean {
  return readCatalogDefaultVisible(WATER_FEATURES_LAYER_ID, catalog);
}

export function buildInitialHydroBasinsVisible(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): boolean {
  return readCatalogDefaultVisible(HYDRO_BASINS_LAYER_ID, catalog);
}

export function buildInitialBasemapVisibilityState(): BasemapVisibilityState {
  return defaultBasemapVisibilityState();
}

interface ResolveUserVisibleLayerIdsArgs {
  readonly boundaryVisibility: BoundaryVisibilityState;
  readonly countyPowerStoryVisibility: CountyPowerStoryVisibilityState;
  readonly fiberVisibility: FiberVisibilityState;
  readonly floodVisibility: FloodVisibilityState;
  readonly gasPipelineVisible: boolean;
  readonly hydroBasinsVisible: boolean;
  readonly marketBoundaryVisibility: MarketBoundaryVisibilityState;
  readonly parcelsVisible: boolean;
  readonly powerVisibility: PowerVisibilityState;
  readonly visiblePerspectives: PerspectiveVisibilityState;
  readonly waterVisible: boolean;
}

export function resolveUserVisibleLayerIds(
  args: ResolveUserVisibleLayerIdsArgs
): readonly LayerId[] {
  const visibleLayerIds: LayerId[] = [];

  pushLayerIfVisible(visibleLayerIds, "county", args.boundaryVisibility.county);
  pushLayerIfVisible(visibleLayerIds, "state", args.boundaryVisibility.state);
  pushLayerIfVisible(visibleLayerIds, "country", args.boundaryVisibility.country);

  pushLayerIfVisible(
    visibleLayerIds,
    facilitiesLayerId("colocation"),
    args.visiblePerspectives.colocation
  );
  pushLayerIfVisible(
    visibleLayerIds,
    facilitiesLayerId("hyperscale"),
    args.visiblePerspectives.hyperscale
  );
  pushLayerIfVisible(
    visibleLayerIds,
    facilitiesLayerId("hyperscale-leased"),
    args.visiblePerspectives["hyperscale-leased"]
  );
  pushLayerIfVisible(
    visibleLayerIds,
    facilitiesLayerId("enterprise"),
    args.visiblePerspectives.enterprise
  );

  pushLayerIfVisible(visibleLayerIds, "markets.market", args.marketBoundaryVisibility.market);
  pushLayerIfVisible(visibleLayerIds, "markets.submarket", args.marketBoundaryVisibility.submarket);

  pushLayerIfVisible(visibleLayerIds, FLOOD_100_LAYER_ID, args.floodVisibility.flood100);
  pushLayerIfVisible(visibleLayerIds, FLOOD_500_LAYER_ID, args.floodVisibility.flood500);
  pushLayerIfVisible(visibleLayerIds, HYDRO_BASINS_LAYER_ID, args.hydroBasinsVisible);
  pushLayerIfVisible(visibleLayerIds, PARCELS_LAYER_ID, args.parcelsVisible);
  pushLayerIfVisible(visibleLayerIds, WATER_FEATURES_LAYER_ID, args.waterVisible);
  pushLayerIfVisible(visibleLayerIds, GAS_PIPELINES_LAYER_ID, args.gasPipelineVisible);

  pushLayerIfVisible(
    visibleLayerIds,
    powerLayerId("transmission"),
    args.powerVisibility.transmission
  );
  pushLayerIfVisible(
    visibleLayerIds,
    powerLayerId("substations"),
    args.powerVisibility.substations
  );
  pushLayerIfVisible(visibleLayerIds, powerLayerId("plants"), args.powerVisibility.plants);

  pushLayerIfVisible(
    visibleLayerIds,
    countyPowerStoryLayerId(args.countyPowerStoryVisibility.storyId),
    args.countyPowerStoryVisibility.visible
  );
  pushLayerIfVisible(
    visibleLayerIds,
    COUNTY_POWER_STORY_3D_LAYER_ID,
    args.countyPowerStoryVisibility.visible && args.countyPowerStoryVisibility.threeDimensional
  );

  pushLayerIfVisible(visibleLayerIds, fiberLayerId("metro"), args.fiberVisibility.metro);
  pushLayerIfVisible(visibleLayerIds, fiberLayerId("longhaul"), args.fiberVisibility.longhaul);

  return visibleLayerIds;
}

export function syncPerspectiveVisibilityState(args: {
  readonly fallback: PerspectiveVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): PerspectiveVisibilityState {
  return {
    colocation: readRuntimeUserVisible(
      args.runtime,
      facilitiesLayerId("colocation"),
      args.fallback.colocation
    ),
    hyperscale: readRuntimeUserVisible(
      args.runtime,
      facilitiesLayerId("hyperscale"),
      args.fallback.hyperscale
    ),
    "hyperscale-leased": readRuntimeUserVisible(
      args.runtime,
      facilitiesLayerId("hyperscale-leased"),
      args.fallback["hyperscale-leased"]
    ),
    enterprise: readRuntimeUserVisible(
      args.runtime,
      facilitiesLayerId("enterprise"),
      args.fallback.enterprise
    ),
  };
}

export function syncBoundaryVisibilityState(args: {
  readonly fallback: BoundaryVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): BoundaryVisibilityState {
  return {
    county: readRuntimeUserVisible(args.runtime, "county", args.fallback.county),
    state: readRuntimeUserVisible(args.runtime, "state", args.fallback.state),
    country: readRuntimeUserVisible(args.runtime, "country", args.fallback.country),
  };
}

export function syncFloodVisibilityState(args: {
  readonly fallback: FloodVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): FloodVisibilityState {
  return {
    flood100: readRuntimeUserVisible(args.runtime, FLOOD_100_LAYER_ID, args.fallback.flood100),
    flood500: readRuntimeUserVisible(args.runtime, FLOOD_500_LAYER_ID, args.fallback.flood500),
  };
}

export function syncPowerVisibilityState(args: {
  readonly fallback: PowerVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): PowerVisibilityState {
  return {
    transmission: readRuntimeUserVisible(
      args.runtime,
      powerLayerId("transmission"),
      args.fallback.transmission
    ),
    substations: readRuntimeUserVisible(
      args.runtime,
      powerLayerId("substations"),
      args.fallback.substations
    ),
    plants: readRuntimeUserVisible(args.runtime, powerLayerId("plants"), args.fallback.plants),
  };
}

function readVisibleCountyPowerStoryId(
  runtime: LayerRuntimeController | null
): CountyPowerStoryId | null {
  for (const storyId of [
    "grid-stress",
    "queue-pressure",
    "market-structure",
    "policy-watch",
  ] as const) {
    if (readRuntimeUserVisible(runtime, countyPowerStoryLayerId(storyId), false)) {
      return storyId;
    }
  }

  return null;
}

export function syncCountyPowerStoryVisibilityState(args: {
  readonly fallback: CountyPowerStoryVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): CountyPowerStoryVisibilityState {
  const visibleStoryId = readVisibleCountyPowerStoryId(args.runtime);
  const visible = visibleStoryId !== null;

  return {
    ...args.fallback,
    storyId: visibleStoryId ?? args.fallback.storyId,
    threeDimensional:
      visible &&
      readRuntimeUserVisible(
        args.runtime,
        COUNTY_POWER_STORY_3D_LAYER_ID,
        args.fallback.threeDimensional
      ),
    visible,
  };
}

export function syncParcelsVisible(args: {
  readonly fallback: boolean;
  readonly runtime: LayerRuntimeController | null;
}): boolean {
  return readRuntimeUserVisible(args.runtime, PARCELS_LAYER_ID, args.fallback);
}

export function syncWaterVisible(args: {
  readonly fallback: boolean;
  readonly runtime: LayerRuntimeController | null;
}): boolean {
  return readRuntimeUserVisible(args.runtime, WATER_FEATURES_LAYER_ID, args.fallback);
}

export function syncHydroBasinsVisible(args: {
  readonly fallback: boolean;
  readonly runtime: LayerRuntimeController | null;
}): boolean {
  return readRuntimeUserVisible(args.runtime, HYDRO_BASINS_LAYER_ID, args.fallback);
}

export function withPerspectiveVisibility(args: {
  readonly perspective: keyof PerspectiveVisibilityState;
  readonly state: PerspectiveVisibilityState;
  readonly visible: boolean;
}): PerspectiveVisibilityState {
  return {
    ...args.state,
    [args.perspective]: args.visible,
  };
}

export function withBoundaryVisibility(args: {
  readonly boundaryId: BoundaryLayerId;
  readonly state: BoundaryVisibilityState;
  readonly visible: boolean;
}): BoundaryVisibilityState {
  return {
    ...args.state,
    [args.boundaryId]: args.visible,
  };
}

export function withFloodVisibility(args: {
  readonly layerId: keyof FloodVisibilityState;
  readonly state: FloodVisibilityState;
  readonly visible: boolean;
}): FloodVisibilityState {
  return {
    ...args.state,
    [args.layerId]: args.visible,
  };
}

export function withPowerVisibility(args: {
  readonly layerId: PowerLayerId;
  readonly state: PowerVisibilityState;
  readonly visible: boolean;
}): PowerVisibilityState {
  return {
    ...args.state,
    [args.layerId]: args.visible,
  };
}

export function withCountyPowerStoryVisibility(args: {
  readonly chapterId?:
    | import("@/features/county-power-story/county-power-story.types").CountyPowerStoryChapterId
    | undefined;
  readonly chapterVisible?: boolean | undefined;
  readonly seamHazeEnabled?: boolean | undefined;
  readonly state: CountyPowerStoryVisibilityState;
  readonly storyId?: CountyPowerStoryId | undefined;
  readonly threeDimensional?: boolean | undefined;
  readonly visible?: boolean | undefined;
  readonly window?: CountyPowerStoryVisibilityState["window"] | undefined;
}): CountyPowerStoryVisibilityState {
  return {
    ...args.state,
    ...(typeof args.chapterId === "undefined" ? {} : { chapterId: args.chapterId }),
    ...(typeof args.chapterVisible === "undefined" ? {} : { chapterVisible: args.chapterVisible }),
    ...(typeof args.seamHazeEnabled === "undefined"
      ? {}
      : { seamHazeEnabled: args.seamHazeEnabled }),
    ...(typeof args.storyId === "undefined" ? {} : { storyId: args.storyId }),
    ...(typeof args.threeDimensional === "undefined"
      ? {}
      : { threeDimensional: args.threeDimensional }),
    ...(typeof args.visible === "undefined" ? {} : { visible: args.visible }),
    ...(typeof args.window === "undefined" ? {} : { window: args.window }),
  };
}
