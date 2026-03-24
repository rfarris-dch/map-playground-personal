import { beforeEach, describe, expect, it, mock } from "bun:test";
import { computed, shallowRef } from "vue";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import type {
  FacilityClusterHoverState,
  FacilityHoverState,
} from "@/features/facilities/hover.types";
import { FakeMap } from "../../../support/fake-map";

function noop(): void {
  /* noop */
}

function createDeferred<T>() {
  let resolve: ((value: T | PromiseLike<T>) => void) | null = null;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve(value: T) {
      resolve?.(value);
    },
  };
}

async function flushPromises(): Promise<void> {
  for (let iteration = 0; iteration < 12; iteration += 1) {
    await Promise.resolve();
  }
}

const setAnimationEnabledMock = mock<(enabled: boolean) => void>();
const setChapterIdMock =
  mock<
    (
      chapterId:
        | "operator-heartbeat"
        | "transfer-friction"
        | "queue-pressure-storm"
        | "transmission-current"
        | "policy-shockwaves"
        | "county-scan"
    ) => Promise<void>
  >();
const setChapterVisibleMock = mock<(visible: boolean) => Promise<void>>();
const setSelectedCountyMock = mock<(countyFips: string | null) => void>();
const setStoryIdMock =
  mock<
    (
      storyId: "grid-stress" | "queue-pressure" | "market-structure" | "policy-watch"
    ) => Promise<void>
  >();
const setThreeDimensionalEnabledMock = mock<(enabled: boolean) => void>();
const setVisibilityManagedByRuntimeMock = mock<(enabled: boolean) => void>();
const setVisibleMock = mock<(visible: boolean) => Promise<void>>();
const setWindowMock = mock<(window: "live" | "30d" | "60d" | "90d") => Promise<void>>();
const setSeamHazeEnabledMock = mock<(enabled: boolean) => void>();
const registerLayerControllerMock =
  mock<
    (
      layerId: string,
      controller: { readonly layerId: string; readonly setVisible: (visible: boolean) => void }
    ) => void
  >();
let lastMountCountyPowerStoryLayerArgs: Record<string, unknown> | null = null;

const mountCountyPowerStoryLayerMock = mock((_map: unknown, args: Record<string, unknown> = {}) => {
  lastMountCountyPowerStoryLayerArgs = args;

  return {
    controller: {
      destroy: noop,
      setAnimationEnabled: setAnimationEnabledMock,
      setChapterId: setChapterIdMock,
      setChapterVisible: setChapterVisibleMock,
      setSelectedCounty: setSelectedCountyMock,
      setSeamHazeEnabled: setSeamHazeEnabledMock,
      setStoryId: setStoryIdMock,
      setThreeDimensionalEnabled: setThreeDimensionalEnabledMock,
      setVisibilityManagedByRuntime: setVisibilityManagedByRuntimeMock,
      setVisible: setVisibleMock,
      setWindow: setWindowMock,
    },
    controllers: {
      "models.county-power-grid-stress": {
        destroy: noop,
        layerId: "models.county-power-grid-stress",
        setVisible: noop,
      },
      "models.county-power-queue-pressure": {
        destroy: noop,
        layerId: "models.county-power-queue-pressure",
        setVisible: noop,
      },
      "models.county-power-market-structure": {
        destroy: noop,
        layerId: "models.county-power-market-structure",
        setVisible: noop,
      },
      "models.county-power-policy-watch": {
        destroy: noop,
        layerId: "models.county-power-policy-watch",
        setVisible: noop,
      },
      "models.county-power-3d": {
        destroy: noop,
        layerId: "models.county-power-3d",
        setVisible: noop,
      },
    },
    destroy: noop,
  };
});

mock.module("@/features/county-power-story/county-power-story.layer", () => ({
  mountCountyPowerStoryLayer: mountCountyPowerStoryLayerMock,
}));

const { initializeCountyPowerStoryRuntime } = await import(
  "../../../../src/features/app/lifecycle/app-shell-county-power-story-runtime.service.ts?county-power-story-runtime-test"
);

function createLifecycleOptions(): UseAppShellMapLifecycleOptions {
  return {
    actions: {
      clearSelectedCountyPowerStory: noop,
      clearSelectedFacility: noop,
      clearSelectedParcel: noop,
      setSelectedCountyPowerStory: noop,
      setSelectedFacility: noop,
      setSelectedParcel: noop,
    },
    areFacilityInteractionsEnabled: computed(() => true),
    fiber: {
      clearFiberHover: noop,
      destroy: noop,
      initialize: noop,
    },
    filters: {
      facilitiesPredicate: shallowRef(null),
      gasFilter: shallowRef(null),
      onCachedFeaturesUpdate: noop,
      onParcelViewportFacets: noop,
      parcelFilter: shallowRef(null),
      parcelViewportFacets: shallowRef(null),
      transmissionFilter: shallowRef(null),
    },
    layers: {
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      countyPowerStoryController: shallowRef(null),
      environmentalStressController: shallowRef(null),
      facilitiesControllers: shallowRef([]),
      facilitiesHoverController: shallowRef(null),
      floodLayersController: shallowRef(null),
      gasPipelineController: shallowRef(null),
      hydroBasinsController: shallowRef(null),
      marketBoundaryControllers: shallowRef({
        market: null,
        submarket: null,
      }),
      parcelsController: shallowRef(null),
      powerHoverController: shallowRef(null),
      powerLayersController: shallowRef(null),
      sketchMeasureController: shallowRef(null),
      waterController: shallowRef(null),
    },
    readInitialUserVisibleLayerIds: () => [],
    runtime: {
      basemapLayerController: shallowRef(null),
      disposeMapRuntime: shallowRef(null),
      interactionCoordinator: shallowRef(null),
      layerRuntime: shallowRef({
        destroy: noop,
        getEffectiveVisible: () => false,
        getUserVisible: () => false,
        registerLayerController: registerLayerControllerMock,
        setStressBlocked: noop,
        setUserVisible: noop,
        unregisterLayerController: noop,
      }),
      map: shallowRef(new FakeMap()),
      mapContainer: shallowRef(null),
      mapInitStatus: shallowRef({
        errorReason: null,
        phase: "ready",
      }),
    },
    state: {
      boundaryFacetOptions: shallowRef({
        country: [],
        county: [],
        state: [],
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFetchError: shallowRef({
        country: false,
        county: false,
        state: false,
      }),
      boundaryHoverByLayer: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clusterClickSignal: shallowRef(0),
      colocationViewportFeatures: shallowRef([]),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: false,
        chapterId: "policy-shockwaves",
        chapterVisible: true,
        seamHazeEnabled: true,
        storyId: "queue-pressure",
        threeDimensional: true,
        visible: true,
        window: "60d",
      }),
      facilitiesStatus: shallowRef({
        colocation: "idle",
        hyperscale: "idle",
      }),
      hoveredBoundary: shallowRef(null),
      hoveredCountyPowerStory: shallowRef(null),
      hoveredFacility: shallowRef(null),
      hoveredFacilityCluster: shallowRef(null),
      hoveredMarketBoundary: shallowRef(null),
      hoveredPower: shallowRef(null),
      hyperscaleViewportFeatures: shallowRef([]),
      layerRuntimeSnapshot: shallowRef(null),
      marketBoundaryColorMode: shallowRef("power"),
      marketBoundaryFacetOptions: shallowRef({
        market: [],
        submarket: [],
      }),
      marketBoundaryFacetSelection: shallowRef({
        market: null,
        submarket: null,
      }),
      marketBoundaryFetchError: shallowRef({
        market: false,
        submarket: false,
      }),
      marketBoundaryHoverByLayer: shallowRef({
        market: null,
        submarket: null,
      }),
      parcelsStatus: shallowRef({
        state: "idle",
      }),
      perspectiveViewModes: shallowRef({
        colocation: "icons",
        enterprise: "dots",
        hyperscale: "icons",
        "hyperscale-leased": "dots",
      }),
      selectedCountyPowerStory: shallowRef(null),
      selectedFacility: shallowRef(null),
      selectedParcel: shallowRef(null),
      sketchMeasureState: shallowRef({
        areaShape: "polygon",
        completedAreaGeometry: null,
        mode: "off",
      }),
    },
    visibility: {
      applyBasemapVisibility: noop,
      syncRuntimeVisibility: noop,
    },
  };
}

describe("county power story runtime service", () => {
  beforeEach(() => {
    mountCountyPowerStoryLayerMock.mockClear();
    registerLayerControllerMock.mockClear();
    setAnimationEnabledMock.mockClear();
    setChapterIdMock.mockReset();
    setChapterVisibleMock.mockReset();
    setSelectedCountyMock.mockClear();
    setSeamHazeEnabledMock.mockClear();
    setStoryIdMock.mockReset();
    setThreeDimensionalEnabledMock.mockClear();
    setVisibilityManagedByRuntimeMock.mockClear();
    setVisibleMock.mockReset();
    setWindowMock.mockReset();
    lastMountCountyPowerStoryLayerArgs = null;

    setChapterIdMock.mockResolvedValue(undefined);
    setChapterVisibleMock.mockResolvedValue(undefined);
    setStoryIdMock.mockResolvedValue(undefined);
    setSeamHazeEnabledMock.mockImplementation(noop);
    setVisibleMock.mockResolvedValue(undefined);
    setWindowMock.mockResolvedValue(undefined);
  });

  it("replays restored visibility even when the shared layer runtime is present", async () => {
    const options = createLifecycleOptions();

    initializeCountyPowerStoryRuntime(options);
    await flushPromises();

    expect(mountCountyPowerStoryLayerMock).toHaveBeenCalledTimes(1);
    expect(setAnimationEnabledMock).toHaveBeenCalledWith(false);
    expect(setChapterIdMock).toHaveBeenCalledWith("policy-shockwaves");
    expect(setChapterVisibleMock).toHaveBeenCalledWith(true);
    expect(setSeamHazeEnabledMock).toHaveBeenCalledWith(true);
    expect(setStoryIdMock).toHaveBeenCalledWith("queue-pressure");
    expect(setWindowMock).toHaveBeenCalledWith("60d");
    expect(registerLayerControllerMock).toHaveBeenCalledTimes(5);
    expect(setVisibilityManagedByRuntimeMock).toHaveBeenCalledWith(true);
    expect(setThreeDimensionalEnabledMock).toHaveBeenCalledWith(true);
    expect(setVisibleMock).toHaveBeenCalledWith(true);
  });

  it("uses the latest county power story state when visibility changes during initialization", async () => {
    const options = createLifecycleOptions();
    options.state.countyPowerStoryVisibility.value = {
      animationEnabled: false,
      chapterId: "operator-heartbeat",
      chapterVisible: false,
      seamHazeEnabled: false,
      storyId: "queue-pressure",
      threeDimensional: false,
      visible: false,
      window: "60d",
    };

    const firstStoryDeferred = createDeferred<void>();
    setStoryIdMock
      .mockImplementationOnce(() => firstStoryDeferred.promise)
      .mockResolvedValue(undefined);

    initializeCountyPowerStoryRuntime(options);

    options.state.countyPowerStoryVisibility.value = {
      animationEnabled: true,
      chapterId: "transmission-current",
      chapterVisible: true,
      seamHazeEnabled: true,
      storyId: "policy-watch",
      threeDimensional: true,
      visible: true,
      window: "90d",
    };

    firstStoryDeferred.resolve(undefined);
    await flushPromises();

    expect(setStoryIdMock.mock.calls.at(-1)?.[0]).toBe("policy-watch");
    expect(setWindowMock.mock.calls.at(-1)?.[0]).toBe("90d");
    expect(setChapterIdMock.mock.calls.at(-1)?.[0]).toBe("transmission-current");
    expect(setChapterVisibleMock.mock.calls.at(-1)?.[0]).toBe(true);
    expect(setSeamHazeEnabledMock.mock.calls.at(-1)?.[0]).toBe(true);
    expect(setThreeDimensionalEnabledMock.mock.calls.at(-1)?.[0]).toBe(true);
    expect(setVisibleMock.mock.calls.at(-1)?.[0]).toBe(true);
  });

  it("suppresses county hover while facility hover state is active", () => {
    const options = createLifecycleOptions();

    initializeCountyPowerStoryRuntime(options);

    const suppressHover = lastMountCountyPowerStoryLayerArgs?.isHoverSuppressed;
    expect(typeof suppressHover).toBe("function");
    if (typeof suppressHover !== "function") {
      return;
    }

    expect(suppressHover()).toBe(false);

    const facilityHover: FacilityHoverState = {
      address: null,
      availablePowerMw: null,
      city: "Austin",
      commissionedPowerMw: 10,
      commissionedSemantic: "existing",
      coordinates: [-97.7431, 30.2672],
      facilityCode: null,
      facilityId: "facility-1",
      facilityName: "Facility 1",
      leaseOrOwn: null,
      marketName: null,
      perspective: "colocation",
      plannedPowerMw: null,
      providerId: "provider-1",
      providerName: "Provider 1",
      screenPoint: [12, 18],
      stateAbbrev: "TX",
      statusLabel: null,
      underConstructionPowerMw: null,
    };
    options.state.hoveredFacility.value = facilityHover;
    expect(suppressHover()).toBe(true);

    options.state.hoveredFacility.value = null;
    const clusterHover: FacilityClusterHoverState = {
      availablePowerMw: 0,
      center: [-97.7431, 30.2672],
      clusterId: 1,
      commissionedPowerMw: 10,
      facilities: [],
      facilityCount: 1,
      perspective: "colocation",
      plannedPowerMw: 0,
      screenPoint: [12, 18],
      topProviders: [],
      totalPowerMw: 10,
      underConstructionPowerMw: 0,
    };
    options.state.hoveredFacilityCluster.value = clusterHover;
    expect(suppressHover()).toBe(true);
  });
});
