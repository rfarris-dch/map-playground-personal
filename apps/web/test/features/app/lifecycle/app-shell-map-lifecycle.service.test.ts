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
    mapRuntime: false,
    parcels: false,
    powerHover: false,
    sketchMeasure: false,
  };
  const mapControls = [createTestMapControl("navigation"), createTestMapControl("scale")];
  const basemapLayerController = {
    destroy() {
      destroyed.basemap = true;
    },
    setVisible: noop,
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
      gasPipelineController: shallowRef(null),
      hydroBasinsController: shallowRef(null),
      parcelsController: shallowRef({
        clearSelection: noop,
        destroy() {
          destroyed.parcels = true;
        },
        setVisible: noop,
      }),
      powerLayersController: shallowRef(null),
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
      basemapLayerController: shallowRef(basemapLayerController),
      disposeMapRuntime: shallowRef(() => {
        basemapLayerController.destroy();
        for (const control of mapControls) {
          fakeMap.removeControl(control);
        }
        fakeMap.destroy();
        destroyed.mapRuntime = true;
        return Promise.resolve();
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
      hoveredFacilityCluster: shallowRef(null),
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
  it("tears down controls, controllers, PMTiles protocol, and map refs without leaking runtime state", async () => {
    const fakeMap = new FakeMap();
    const options = createLifecycleOptions(fakeMap);

    await destroyMapLifecycleRuntime(options);

    expect(fakeMap.removedControls).toHaveLength(2);
    expect(fakeMap.destroyed).toBe(true);
    expect(options.runtime.map.value).toBeNull();
    expect(options.runtime.layerRuntime.value).toBeNull();
    expect(options.runtime.basemapLayerController.value).toBeNull();
    expect(options.runtime.disposeMapRuntime.value).toBeNull();
    expect(options.state.layerRuntimeSnapshot.value).toBeNull();
    expect(options.layers.boundaryControllers.value).toEqual({
      country: null,
      county: null,
      state: null,
    });
  });
});
