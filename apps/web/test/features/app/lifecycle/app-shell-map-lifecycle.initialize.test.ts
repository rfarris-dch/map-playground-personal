import { beforeEach, describe, expect, it, mock } from "bun:test";
import { computed, shallowRef } from "vue";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { FakeMap } from "../../../support/fake-map";

function noop(): void {
  /* noop */
}

const startBrowserScopedEffectMock = mock();
const createMapInteractionCoordinatorMock = mock();
const createLayerRuntimeMock = mock();
const initializeBoundaryRuntimeMock = mock(noop);
const initializeMarketBoundaryRuntimeMock = mock(noop);
const initializeMapLayerRuntimeMock = mock(noop);

mock.module("@map-migration/core-runtime/browser", () => ({
  startBrowserScopedEffect: startBrowserScopedEffectMock,
}));

mock.module("@/features/app/interaction/map-interaction.service", () => ({
  createMapInteractionCoordinator: createMapInteractionCoordinatorMock,
}));

mock.module("@/features/layers/layer-runtime.service", () => ({
  createLayerRuntime: createLayerRuntimeMock,
}));

mock.module("@/features/app/boundary/app-shell-boundary-runtime.service", () => ({
  destroyBoundaryRuntime: noop,
  initializeBoundaryRuntime: initializeBoundaryRuntimeMock,
  resetBoundaryRuntime: noop,
}));

mock.module("@/features/app/market-boundary/app-shell-market-boundary-runtime.service", () => ({
  destroyMarketBoundaryRuntime: noop,
  initializeMarketBoundaryRuntime: initializeMarketBoundaryRuntimeMock,
  resetMarketBoundaryRuntime: noop,
}));

mock.module("@/features/app/lifecycle/app-shell-map-layer-runtime.service", () => ({
  destroyMapLayerRuntime: noop,
  initializeMapLayerRuntime: initializeMapLayerRuntimeMock,
}));

const { initializeMapLifecycleRuntime } = await import(
  "../../../../src/features/app/lifecycle/app-shell-map-lifecycle.service.ts?map-lifecycle-initialize-test"
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
    initialViewport: {
      bounds: {
        east: -96.75,
        north: 32.98,
        south: 32.87,
        west: -96.84,
      },
      type: "bounds",
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
      layerRuntime: shallowRef(null),
      map: shallowRef(null),
      mapContainer: shallowRef({} as HTMLDivElement),
      mapInitStatus: shallowRef({
        errorReason: null,
        phase: "initializing",
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
        animationEnabled: true,
        storyId: "grid-stress",
        threeDimensional: false,
        visible: false,
        window: "live",
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

describe("app-shell map lifecycle initialization", () => {
  beforeEach(() => {
    startBrowserScopedEffectMock.mockReset();
    createMapInteractionCoordinatorMock.mockReset();
    createLayerRuntimeMock.mockReset();
    initializeBoundaryRuntimeMock.mockClear();
    initializeMarketBoundaryRuntimeMock.mockClear();
    initializeMapLayerRuntimeMock.mockClear();
  });

  it("applies the initial route viewport before interaction-driven layers initialize", async () => {
    const fakeMap = new FakeMap();
    const options = createLifecycleOptions();
    let boundsWhenCoordinatorCreated: ReturnType<FakeMap["getBounds"]> | null = null;
    let boundsWhenLayersMounted: ReturnType<FakeMap["getBounds"]> | null = null;

    startBrowserScopedEffectMock.mockResolvedValue({
      dispose: async () => undefined,
      value: {
        basemapLayerController: {
          destroy: noop,
          setVisible: noop,
        },
        map: fakeMap,
      },
    });
    createMapInteractionCoordinatorMock.mockImplementation((map: FakeMap) => {
      boundsWhenCoordinatorCreated = map.getBounds();
      return {
        destroy: noop,
        getLastSnapshot: () => null,
        subscribe: () => () => undefined,
      };
    });
    createLayerRuntimeMock.mockReturnValue({
      destroy: noop,
      getEffectiveVisible: () => false,
      getUserVisible: () => false,
      registerLayerController: noop,
      setStressBlocked: noop,
      setUserVisible: noop,
      unregisterLayerController: noop,
    });
    initializeMapLayerRuntimeMock.mockImplementation(
      (nextOptions: UseAppShellMapLifecycleOptions) => {
        boundsWhenLayersMounted = nextOptions.runtime.map.value?.getBounds() ?? null;
      }
    );

    await initializeMapLifecycleRuntime(options);

    expect(boundsWhenCoordinatorCreated).toEqual(options.initialViewport?.bounds ?? null);
    expect(boundsWhenLayersMounted).toEqual(options.initialViewport?.bounds ?? null);
    expect(options.runtime.map.value).toBe(fakeMap);
  });
});
