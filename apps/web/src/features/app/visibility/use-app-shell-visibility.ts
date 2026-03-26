import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { shallowRef } from "vue";
import type { MarketBoundaryVisibilityState } from "@/features/app/components/map-layer-controls-panel.types";
import {
  COUNTY_POWER_STORY_3D_LAYER_ID,
  countyPowerStoryLayerId,
  FLOOD_100_LAYER_ID,
  FLOOD_500_LAYER_ID,
  facilitiesLayerId,
  GAS_PIPELINES_LAYER_ID,
  HYDRO_BASINS_LAYER_ID,
  PARCELS_LAYER_ID,
  powerLayerId,
  WATER_FEATURES_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import type {
  BoundaryVisibilityState,
  FloodVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import {
  buildInitialBoundaryVisibilityState,
  buildInitialCountyPowerStoryVisibilityState,
  buildInitialFloodVisibilityState,
  buildInitialHydroBasinsVisible,
  buildInitialParcelsVisible,
  buildInitialPerspectiveVisibilityState,
  buildInitialPowerVisibilityState,
  buildInitialWaterVisible,
  syncBoundaryVisibilityState,
  syncCountyPowerStoryVisibilityState,
  syncFloodVisibilityState,
  syncHydroBasinsVisible,
  syncParcelsVisible,
  syncPerspectiveVisibilityState,
  syncPowerVisibilityState,
  syncWaterVisible,
  withBoundaryVisibility,
  withCountyPowerStoryVisibility,
  withFloodVisibility,
  withPerspectiveVisibility,
  withPowerVisibility,
} from "@/features/app/visibility/app-shell-visibility.service";
import type { UseAppShellVisibilityOptions } from "@/features/app/visibility/use-app-shell-visibility.types";
import {
  basemapLayerIds,
  buildInitialBasemapVisibilityState,
  isBasemapLayerVisible,
  withBasemapLayerVisibility,
} from "@/features/basemap/basemap.service";
import type { BasemapLayerId, BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import { defaultCountyPowerStoryChapterId } from "@/features/county-power-story/county-power-story.service";
import type {
  CountyPowerStoryId,
  CountyPowerStoryVisibilityState,
} from "@/features/county-power-story/county-power-story.types";
import type { MarketBoundaryLayerId } from "@/features/market-boundaries/market-boundaries.types";
import type { PowerLayerId, PowerVisibilityState } from "@/features/power/power.types";

export function useAppShellVisibility(options: UseAppShellVisibilityOptions) {
  const basemapVisibility = shallowRef<BasemapVisibilityState>(
    buildInitialBasemapVisibilityState()
  );
  const boundaryVisibility = shallowRef<BoundaryVisibilityState>(
    buildInitialBoundaryVisibilityState()
  );
  const floodVisibility = shallowRef<FloodVisibilityState>(buildInitialFloodVisibilityState());
  const visiblePerspectives = shallowRef<PerspectiveVisibilityState>(
    buildInitialPerspectiveVisibilityState()
  );
  const countyPowerStoryVisibility = options.countyPowerStoryVisibility;
  if (
    countyPowerStoryVisibility.value.storyId === "grid-stress" &&
    !countyPowerStoryVisibility.value.visible
  ) {
    countyPowerStoryVisibility.value = buildInitialCountyPowerStoryVisibilityState();
  }
  const marketBoundaryVisibility = shallowRef<MarketBoundaryVisibilityState>({
    market: false,
    submarket: false,
  });
  const gasPipelineVisible = shallowRef<boolean>(false);
  const hydroBasinsVisible = shallowRef<boolean>(buildInitialHydroBasinsVisible());
  const parcelsVisible = shallowRef<boolean>(buildInitialParcelsVisible());
  const powerVisibility = shallowRef<PowerVisibilityState>(buildInitialPowerVisibilityState());
  const waterVisible = shallowRef<boolean>(buildInitialWaterVisible());
  let countyPowerStoryMutationVersion = 0;
  let countyPowerStorySettledVersion = 0;
  let countyPowerStoryReconcilePromise: Promise<void> | null = null;

  function applyBasemapVisibility(): void {
    const controller = options.basemapLayerController.value;
    if (controller === null) {
      return;
    }

    for (const layerId of basemapLayerIds()) {
      controller.setVisible(layerId, isBasemapLayerVisible(basemapVisibility.value, layerId));
    }
  }

  function syncRuntimeVisibility(): void {
    const runtime = options.layerRuntime.value;

    visiblePerspectives.value = syncPerspectiveVisibilityState({
      runtime,
      fallback: visiblePerspectives.value,
    });
    boundaryVisibility.value = syncBoundaryVisibilityState({
      runtime,
      fallback: boundaryVisibility.value,
    });
    floodVisibility.value = syncFloodVisibilityState({
      runtime,
      fallback: floodVisibility.value,
    });
    hydroBasinsVisible.value = syncHydroBasinsVisible({
      runtime,
      fallback: hydroBasinsVisible.value,
    });
    parcelsVisible.value = syncParcelsVisible({
      runtime,
      fallback: parcelsVisible.value,
    });
    powerVisibility.value = syncPowerVisibilityState({
      runtime,
      fallback: powerVisibility.value,
    });
    countyPowerStoryVisibility.value = syncCountyPowerStoryVisibilityState({
      runtime,
      fallback: countyPowerStoryVisibility.value,
    });
    waterVisible.value = syncWaterVisible({
      runtime,
      fallback: waterVisible.value,
    });
  }

  function setPerspectiveVisibility(perspective: FacilityPerspective, visible: boolean): void {
    visiblePerspectives.value = withPerspectiveVisibility({
      perspective,
      visible,
      state: visiblePerspectives.value,
    });
    options.layerRuntime.value?.setUserVisible(facilitiesLayerId(perspective), visible);

    if (!visible) {
      options.setViewportFacilities(perspective, []);
    }
  }

  function setParcelsVisible(visible: boolean): void {
    parcelsVisible.value = visible;
    options.layerRuntime.value?.setUserVisible(PARCELS_LAYER_ID, visible);

    if (!visible) {
      options.clearSelectedParcel();
    }
  }

  function setBasemapLayerVisible(layerId: BasemapLayerId, visible: boolean): void {
    basemapVisibility.value = withBasemapLayerVisibility(basemapVisibility.value, layerId, visible);
    options.basemapLayerController.value?.setVisible(layerId, visible);
  }

  function setBasemapLayerColor(targetLayer: string, color: string): void {
    options.basemapLayerController.value?.setLayerColor(targetLayer, color);
  }

  function setFloodLayerVisible(layerId: keyof FloodVisibilityState, visible: boolean): void {
    floodVisibility.value = withFloodVisibility({
      layerId,
      visible,
      state: floodVisibility.value,
    });

    const catalogLayerId = layerId === "flood100" ? FLOOD_100_LAYER_ID : FLOOD_500_LAYER_ID;
    options.layerRuntime.value?.setUserVisible(catalogLayerId, visible);
  }

  function setHydroBasinsVisible(visible: boolean): void {
    hydroBasinsVisible.value = visible;
    options.layerRuntime.value?.setUserVisible(HYDRO_BASINS_LAYER_ID, visible);
  }

  function setGasPipelineVisible(visible: boolean): void {
    gasPipelineVisible.value = visible;
    options.gasPipelineController?.value?.setVisible(visible);
    options.layerRuntime.value?.setUserVisible(GAS_PIPELINES_LAYER_ID, visible);
  }

  function setWaterVisible(visible: boolean): void {
    waterVisible.value = visible;
    options.layerRuntime.value?.setUserVisible(WATER_FEATURES_LAYER_ID, visible);
  }

  function setPowerLayerVisible(layerId: PowerLayerId, visible: boolean): void {
    powerVisibility.value = withPowerVisibility({
      layerId,
      visible,
      state: powerVisibility.value,
    });
    options.layerRuntime.value?.setUserVisible(powerLayerId(layerId), visible);
    options.clearPowerHover();
  }

  function setMarketBoundaryVisible(layerId: MarketBoundaryLayerId, visible: boolean): void {
    marketBoundaryVisibility.value = {
      ...marketBoundaryVisibility.value,
      [layerId]: visible,
    };
    const catalogId = layerId === "market" ? "markets.market" : "markets.submarket";
    options.layerRuntime.value?.setUserVisible(catalogId, visible);
  }

  function applyCountyPowerStoryRuntimeVisibility(
    visibility: CountyPowerStoryVisibilityState
  ): void {
    for (const candidateStoryId of [
      "grid-stress",
      "queue-pressure",
      "market-structure",
      "policy-watch",
    ] as const) {
      options.layerRuntime.value?.setUserVisible(
        countyPowerStoryLayerId(candidateStoryId),
        visibility.visible && candidateStoryId === visibility.storyId
      );
    }

    options.layerRuntime.value?.setUserVisible(
      COUNTY_POWER_STORY_3D_LAYER_ID,
      visibility.visible && visibility.threeDimensional
    );
  }

  function updateCountyPowerStoryVisibility(
    nextVisibility: CountyPowerStoryVisibilityState
  ): CountyPowerStoryVisibilityState {
    countyPowerStoryVisibility.value = nextVisibility;
    countyPowerStoryMutationVersion += 1;
    applyCountyPowerStoryRuntimeVisibility(nextVisibility);
    return nextVisibility;
  }

  function hasNewerCountyPowerStoryMutation(requestedVersion: number): boolean {
    return requestedVersion !== countyPowerStoryMutationVersion;
  }

  function readCountyPowerStoryController() {
    return options.countyPowerStoryController.value?.controller ?? null;
  }

  async function applyCountyPowerStoryControllerVisibility(
    requestedVersion: number,
    requestedVisibility: CountyPowerStoryVisibilityState
  ): Promise<boolean> {
    const controller = readCountyPowerStoryController();
    if (controller === null) {
      countyPowerStorySettledVersion = requestedVersion;
      return true;
    }

    const createSyncStep = (apply: () => void) => {
      return () => {
        apply();
        return Promise.resolve();
      };
    };

    const steps = [
      createSyncStep(() => {
        controller.setAnimationEnabled(requestedVisibility.animationEnabled);
      }),
      async () => {
        await controller.setStoryId(requestedVisibility.storyId);
      },
      async () => {
        await controller.setWindow(requestedVisibility.window);
      },
      async () => {
        await controller.setChapterId(requestedVisibility.chapterId);
      },
      async () => {
        await controller.setChapterVisible(requestedVisibility.chapterVisible);
      },
      createSyncStep(() => {
        controller.setSeamHazeEnabled(requestedVisibility.seamHazeEnabled);
      }),
      createSyncStep(() => {
        controller.setThreeDimensionalEnabled(requestedVisibility.threeDimensional);
      }),
    ];

    for (const step of steps) {
      await step();
      if (hasNewerCountyPowerStoryMutation(requestedVersion)) {
        return false;
      }
    }

    if (!requestedVisibility.visible) {
      options.clearCountyPowerStoryHover();
      options.clearSelectedCountyPowerStory();
      controller.setSelectedCounty(null);
    }

    countyPowerStorySettledVersion = requestedVersion;
    return true;
  }

  async function reconcileCountyPowerStoryVisibility(): Promise<void> {
    if (countyPowerStoryReconcilePromise !== null) {
      await countyPowerStoryReconcilePromise;
      return;
    }

    countyPowerStoryReconcilePromise = (async () => {
      while (countyPowerStorySettledVersion < countyPowerStoryMutationVersion) {
        const requestedVersion = countyPowerStoryMutationVersion;
        const requestedVisibility = countyPowerStoryVisibility.value;
        await applyCountyPowerStoryControllerVisibility(requestedVersion, requestedVisibility);
      }
    })().finally(() => {
      countyPowerStoryReconcilePromise = null;
    });

    await countyPowerStoryReconcilePromise;
  }

  function scheduleCountyPowerStoryReconcile(): void {
    reconcileCountyPowerStoryVisibility().catch((error: unknown) => {
      console.error("[county-power-story] visibility reconciliation failed", error);
    });
  }

  async function setCountyPowerStoryVisible(
    storyId: CountyPowerStoryId,
    visible: boolean
  ): Promise<void> {
    const nextChapterId =
      countyPowerStoryVisibility.value.storyId === storyId
        ? countyPowerStoryVisibility.value.chapterId
        : defaultCountyPowerStoryChapterId(storyId);

    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        state: countyPowerStoryVisibility.value,
        ...(visible ? { chapterId: nextChapterId, storyId } : {}),
        visible,
      })
    );

    await reconcileCountyPowerStoryVisibility();
  }

  async function setCountyPowerStoryStoryId(storyId: CountyPowerStoryId): Promise<void> {
    const nextChapterId =
      countyPowerStoryVisibility.value.storyId === storyId
        ? countyPowerStoryVisibility.value.chapterId
        : defaultCountyPowerStoryChapterId(storyId);

    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        chapterId: nextChapterId,
        state: countyPowerStoryVisibility.value,
        storyId,
      })
    );

    await reconcileCountyPowerStoryVisibility();
  }

  async function setCountyPowerStoryWindow(
    window: import("@/features/county-power-story/county-power-story.types").CountyPowerStoryVisibilityState["window"]
  ): Promise<void> {
    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        state: countyPowerStoryVisibility.value,
        window,
      })
    );

    await reconcileCountyPowerStoryVisibility();
  }

  async function setCountyPowerStoryChapterId(
    chapterId: import("@/features/county-power-story/county-power-story.types").CountyPowerStoryChapterId
  ): Promise<void> {
    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        state: countyPowerStoryVisibility.value,
        chapterId,
      })
    );

    await reconcileCountyPowerStoryVisibility();
  }

  async function setCountyPowerStoryChapterVisible(visible: boolean): Promise<void> {
    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        state: countyPowerStoryVisibility.value,
        chapterVisible: visible,
      })
    );

    await reconcileCountyPowerStoryVisibility();
  }

  function setCountyPowerStoryAnimationEnabled(enabled: boolean): void {
    updateCountyPowerStoryVisibility({
      ...countyPowerStoryVisibility.value,
      animationEnabled: enabled,
    });
    readCountyPowerStoryController()?.setAnimationEnabled(enabled);
    scheduleCountyPowerStoryReconcile();
  }

  function setCountyPowerStorySeamHazeEnabled(enabled: boolean): void {
    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        state: countyPowerStoryVisibility.value,
        seamHazeEnabled: enabled,
      })
    );
    readCountyPowerStoryController()?.setSeamHazeEnabled(enabled);
    scheduleCountyPowerStoryReconcile();
  }

  function setCountyPowerStoryThreeDimensionalEnabled(enabled: boolean): void {
    updateCountyPowerStoryVisibility(
      withCountyPowerStoryVisibility({
        state: countyPowerStoryVisibility.value,
        threeDimensional: enabled,
      })
    );
    readCountyPowerStoryController()?.setThreeDimensionalEnabled(enabled);
    scheduleCountyPowerStoryReconcile();
  }

  function setBoundaryVisible(boundaryId: BoundaryLayerId, visible: boolean): void {
    boundaryVisibility.value = withBoundaryVisibility({
      boundaryId,
      visible,
      state: boundaryVisibility.value,
    });

    if (visible) {
      options.boundaryFacetSelection.value = {
        ...options.boundaryFacetSelection.value,
        [boundaryId]: null,
      };
      options.boundaryControllers.value[boundaryId]?.setIncludedRegionIds(null);
    }

    options.layerRuntime.value?.setUserVisible(boundaryId, visible);
  }

  return {
    basemapVisibility,
    boundaryVisibility,
    floodVisibility,
    visiblePerspectives,
    countyPowerStoryVisibility,
    hydroBasinsVisible,
    parcelsVisible,
    powerVisibility,
    waterVisible,
    applyBasemapVisibility,
    syncRuntimeVisibility,
    setPerspectiveVisibility,
    setParcelsVisible,
    setBasemapLayerVisible,
    setBasemapLayerColor,
    setFloodLayerVisible,
    setHydroBasinsVisible,
    setPowerLayerVisible,
    gasPipelineVisible,
    marketBoundaryVisibility,
    setGasPipelineVisible,
    setCountyPowerStoryAnimationEnabled,
    setCountyPowerStoryChapterId,
    setCountyPowerStoryChapterVisible,
    setCountyPowerStorySeamHazeEnabled,
    setCountyPowerStoryStoryId,
    setCountyPowerStoryThreeDimensionalEnabled,
    setCountyPowerStoryVisible,
    setCountyPowerStoryWindow,
    setMarketBoundaryVisible,
    setWaterVisible,
    setBoundaryVisible,
  };
}
