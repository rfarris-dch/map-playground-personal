import { describe, expect, it } from "bun:test";
import { shallowRef } from "vue";
import { destroyMapLifecycleRuntime } from "@/features/app/lifecycle/app-shell-map-lifecycle.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { createTestMapControl, FakeMap } from "../../../support/fake-map";

function noop(): void {
  /* noop */
}

function createLifecycleOptions(fakeMap: FakeMap): UseAppShellMapLifecycleOptions {
  const destroyed = {
    basemap: false,
    boundaryCountry: false,
    facilitiesHover: false,
    layerRuntime: false,
    parcels: false,
    pmtiles: false,
    powerHover: false,
    restoreWarn: false,
    sketchMeasure: false,
  };

  return {
    actions: {
      clearSelectedFacility: noop,
      clearSelectedParcel: noop,
      setSelectedFacility: noop,
      setSelectedParcel: noop,
    },
    areFacilityInteractionsEnabled: shallowRef(true),
    fiber: {
      clearFiberHover: noop,
      destroy: noop,
      initialize: noop,
    },
    layers: {
      boundaryControllers: shallowRef({
        country: {
          clearHover: noop,
          destroy() {
            destroyed.boundaryCountry = true;
          },
          setIncludedRegionIds: noop,
        },
        county: null,
        state: null,
      }),
      environmentalStressController: shallowRef(null),
      facilitiesControllers: shallowRef([]),
      facilitiesHoverController: shallowRef({
        clear: noop,
        destroy() {
          destroyed.facilitiesHover = true;
        },
      }),
      floodLayersController: shallowRef(null),
      hydroBasinsController: shallowRef(null),
      parcelsController: shallowRef({
        clearSelection: noop,
        destroy() {
          destroyed.parcels = true;
        },
        setVisible: noop,
      }),
      powerControllers: shallowRef([]),
      powerHoverController: shallowRef({
        clear: noop,
        destroy() {
          destroyed.powerHover = true;
        },
      }),
      sketchMeasureController: shallowRef({
        clear: noop,
        destroy() {
          destroyed.sketchMeasure = true;
        },
        finishArea: noop,
        setAreaShape: noop,
        setMode: noop,
      }),
      waterController: shallowRef(null),
    },
    runtime: {
      basemapLayerController: shallowRef({
        destroy() {
          destroyed.basemap = true;
        },
        setVisible: noop,
      }),
      disposePmtilesProtocol: shallowRef(() => {
        destroyed.pmtiles = true;
      }),
      layerRuntime: shallowRef({
        destroy() {
          destroyed.layerRuntime = true;
        },
        getEffectiveVisible() {
          return false;
        },
        getUserVisible() {
          return false;
        },
        registerLayerController: noop,
        setStressBlocked: noop,
        setUserVisible: noop,
        unregisterLayerController: noop,
      }),
      map: shallowRef(fakeMap),
      mapContainer: shallowRef(null),
      mapControls: shallowRef([createTestMapControl("navigation"), createTestMapControl("scale")]),
      restoreConsoleWarn: shallowRef(() => {
        destroyed.restoreWarn = true;
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
      boundaryHoverByLayer: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      colocationViewportFeatures: shallowRef([]),
      facilitiesStatus: shallowRef({
        colocation: "idle",
        hyperscale: "idle",
      }),
      hoveredBoundary: shallowRef(null),
      hoveredFacility: shallowRef(null),
      hoveredPower: shallowRef(null),
      hyperscaleViewportFeatures: shallowRef([]),
      layerRuntimeSnapshot: shallowRef({
        effectiveVisibility: {},
        stressBlocked: {},
        userVisibility: {},
      }),
      parcelsStatus: shallowRef({
        state: "idle",
      }),
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

describe("app-shell-map-lifecycle service", () => {
  it("tears down controls, controllers, PMTiles protocol, and map refs without leaking runtime state", () => {
    const fakeMap = new FakeMap();
    const options = createLifecycleOptions(fakeMap);

    destroyMapLifecycleRuntime(options);

    expect(fakeMap.removedControls).toHaveLength(2);
    expect(fakeMap.destroyed).toBe(true);
    expect(options.runtime.map.value).toBeNull();
    expect(options.runtime.layerRuntime.value).toBeNull();
    expect(options.runtime.basemapLayerController.value).toBeNull();
    expect(options.runtime.disposePmtilesProtocol.value).toBeNull();
    expect(options.runtime.restoreConsoleWarn.value).toBeNull();
    expect(options.runtime.mapControls.value).toEqual([]);
    expect(options.state.layerRuntimeSnapshot.value).toBeNull();
    expect(options.layers.boundaryControllers.value).toEqual({
      country: null,
      county: null,
      state: null,
    });
  });
});
