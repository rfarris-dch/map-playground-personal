import { describe, expect, it } from "bun:test";
import {
  MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
  type MapContextTransfer,
} from "@map-migration/http-contracts/map-context-transfer";
import { createMemoryHistory, createRouter, type LocationQueryRaw } from "vue-router";
import {
  applyMapContextTransferToAppShell,
  buildMapContextTransferFromAppShell,
  buildMapContextTransferQuery,
  inferMapContextSurfaceFromRoute,
  readMapContextTransferFromRoute,
} from "@/features/map-context-transfer/map-context-transfer.service";
import { FakeMap } from "../../support/fake-map";

const TestPage = {
  template: "<div />",
};

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/map", name: "map", component: TestPage },
      { path: "/markets/:slug/map", name: "market-map", component: TestPage },
      { path: "/companies/:kind/:slug/map", name: "company-map", component: TestPage },
      {
        path: "/dashboard/selection",
        name: "spatial-analysis-dashboard",
        component: TestPage,
      },
    ],
  });
}

function resolveRoute(name: string, query: LocationQueryRaw = {}) {
  let params: Record<string, string> = {};
  if (name === "market-map") {
    params = { slug: "dallas" };
  } else if (name === "company-map") {
    params = { kind: "provider", slug: "acme" };
  }

  return createTestRouter().resolve({
    name,
    params,
    query,
  });
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
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

describe("map-context-transfer service", () => {
  it("infers scoped route surfaces when the route has no inline context", () => {
    const route = resolveRoute("market-map");

    expect(inferMapContextSurfaceFromRoute(route)).toBe("market-map");
    expect(readMapContextTransferFromRoute({ route })).toEqual({
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "market-map",
      targetSurface: "market-map",
    });
  });

  it("merges stored context tokens with inline boundary and viewport query state", () => {
    const storedContext: MapContextTransfer = {
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "market-map",
      targetSurface: "market-map",
      facilityViewModes: {
        colocation: "dots",
      },
      marketIds: ["dfw"],
      selectedBoundaryIds: {
        country: ["us"],
        county: ["48113"],
      },
      viewport: {
        type: "center",
        center: [-97.12, 32.81],
        zoom: 8.2,
      },
    };
    const route = resolveRoute("map", {
      mapContextToken: "stored-token",
      colocationViewMode: "dots",
      map: "9.5/32.7767/-96.797",
      stateIds: "tx",
    });

    const context = readMapContextTransferFromRoute({
      route,
      store: {
        load(token) {
          return token === "stored-token" ? storedContext : null;
        },
        save() {
          throw new Error("save should not be called while reading context");
        },
      },
    });

    expect(context).toEqual({
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "market-map",
      targetSurface: "global-map",
      contextToken: "stored-token",
      facilityViewModes: {
        colocation: "dots",
      },
      marketIds: ["dfw"],
      selectedBoundaryIds: {
        country: ["us"],
        county: ["48113"],
        state: ["tx"],
      },
      viewport: {
        type: "center",
        center: [-96.797, 32.7767],
        zoom: 9.5,
      },
    });
  });

  it("parses legacy split viewport query params for existing shared links", () => {
    const route = resolveRoute("map", {
      mapBearing: "18",
      mapCenter: "-96.797,32.7767",
      mapPitch: "50",
      mapZoom: "9.5",
    });

    const context = readMapContextTransferFromRoute({ route });

    expect(context?.viewport).toEqual({
      bearing: 18,
      center: [-96.797, 32.7767],
      pitch: 50,
      type: "center",
      zoom: 9.5,
    });
  });

  it("stores oversized ids in session-backed context tokens and round-trips them", () => {
    const longFacilityIds = [
      "facility-alpha-0001",
      "facility-beta-0002",
      "facility-gamma-0003",
      "facility-delta-0004",
      "facility-epsilon-0005",
      "facility-zeta-0006",
      "facility-eta-0007",
      "facility-theta-0008",
      "facility-iota-0009",
      "facility-kappa-0010",
    ];
    const context: MapContextTransfer = {
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "global-map",
      targetSurface: "selection-dashboard",
      facilityIds: longFacilityIds,
      selectedBoundaryIds: {
        state: ["tx"],
      },
    };

    const query = buildMapContextTransferQuery(context, {
      load() {
        return null;
      },
      save(savedContext) {
        expect(savedContext).toEqual(context);
        return "saved-token";
      },
    });

    expect(query.facilityIds).toBeUndefined();
    expect(query.mapContextToken).toBe("saved-token");

    const roundTrip = readMapContextTransferFromRoute({
      route: resolveRoute("spatial-analysis-dashboard", query),
      store: {
        load(token) {
          return token === "saved-token" ? context : null;
        },
        save() {
          throw new Error("save should not be called during round-trip read");
        },
      },
    });

    expect(roundTrip).toEqual({
      ...context,
      contextToken: "saved-token",
      targetSurface: "selection-dashboard",
    });
  });

  it("reuses a preferred context token for oversized state writes", () => {
    const context: MapContextTransfer = {
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "global-map",
      targetSurface: "global-map",
      facilityIds: [
        "facility-alpha-0001",
        "facility-beta-0002",
        "facility-gamma-0003",
        "facility-delta-0004",
        "facility-epsilon-0005",
        "facility-zeta-0006",
        "facility-eta-0007",
        "facility-theta-0008",
        "facility-iota-0009",
        "facility-kappa-0010",
      ],
    };

    const query = buildMapContextTransferQuery(
      context,
      {
        load() {
          return null;
        },
        save(savedContext, token) {
          expect(savedContext).toEqual(context);
          expect(token).toBe("existing-token");
          return token ?? "unexpected-token";
        },
      },
      "existing-token"
    );

    expect(query.mapContextToken).toBe("existing-token");
  });

  it("builds query state with camera, layer, basemap, and fiber selections", () => {
    const context = buildMapContextTransferFromAppShell({
      basemapVisibility: {
        boundaries: false,
        buildings3d: true,
        color: false,
        globe: false,
        labels: true,
        landmarks: false,
        roads: true,
        satellite: false,
        terrain: false,
      },
      boundaryFacetSelection: {
        country: null,
        county: ["48113"],
        state: ["tx"],
      },
      layerRuntimeSnapshot: {
        effectiveVisibility: {},
        stressBlocked: {},
        userVisibility: {
          "facilities.colocation": true,
          "facilities.hyperscale": false,
          "fiber-locator.metro": true,
          "fiber-locator.longhaul": false,
          "power.plants": true,
        },
      },
      map: new FakeMap({
        bearing: 18,
        center: [-96.8, 32.78],
        pitch: 50,
        zoom: 9.25,
      }),
      fiberVisibility: {
        longhaul: false,
        metro: true,
      },
      selectedFiberSourceLayerNames: {
        longhaul: [],
        metro: ["att", "zayo"],
      },
      perspectiveViewModes: {
        colocation: "clusters",
        hyperscale: "dots",
      },
      sourceSurface: "global-map",
      targetSurface: "global-map",
      visiblePerspectives: {
        colocation: true,
        hyperscale: false,
      },
    });

    expect(context.viewport).toEqual({
      bearing: 18,
      center: [-96.8, 32.78],
      pitch: 50,
      type: "center",
      zoom: 9.25,
    });
    expect(context.visibleLayerIds).toEqual([
      "facilities.colocation",
      "fiber-locator.metro",
      "power.plants",
    ]);
    expect(context.facilityViewModes).toEqual({
      colocation: "clusters",
      hyperscale: "dots",
    });
    expect(context.visibleBasemapLayerIds).toEqual(["buildings3d", "labels", "roads"]);
    expect(context.selectedFiberSourceLayerNames).toEqual({
      metro: ["att", "zayo"],
    });

    const query = buildMapContextTransferQuery(context);
    expect(query.map).toBe("9.25/32.78/-96.8/18/50");
    expect(query.colocationViewMode).toBe("clusters");
    expect(query.hyperscaleViewMode).toBe("dots");
    expect(query.visibleLayerIds).toBe("facilities.colocation,fiber-locator.metro,power.plants");
    expect(query.basemapLayerIds).toBe("buildings3d,labels,roads");
    expect(query.fiberMetroSourceLayerNames).toBe("att,zayo");
  });

  it("stores and restores full county power story visibility state through context tokens", () => {
    const countyPowerStoryVisibility: NonNullable<
      MapContextTransfer["countyPowerStoryVisibility"]
    > = {
      animationEnabled: false,
      chapterId: "policy-shockwaves",
      chapterVisible: false,
      seamHazeEnabled: true,
      storyId: "queue-pressure",
      threeDimensional: true,
      visible: false,
      window: "90d",
    };
    const context = buildMapContextTransferFromAppShell({
      boundaryFacetSelection: {
        country: null,
        county: null,
        state: null,
      },
      countyPowerStoryVisibility,
      map: null,
      sourceSurface: "global-map",
      targetSurface: "global-map",
      visiblePerspectives: {
        colocation: false,
        enterprise: false,
        hyperscale: false,
        "hyperscale-leased": false,
      },
    });

    expect(context.countyPowerStoryVisibility).toEqual(countyPowerStoryVisibility);

    const query = buildMapContextTransferQuery(context, {
      load() {
        return null;
      },
      save(savedContext) {
        expect(savedContext.countyPowerStoryVisibility).toEqual(countyPowerStoryVisibility);
        return "county-story-token";
      },
    });

    expect(query.mapContextToken).toBe("county-story-token");

    const roundTrip = readMapContextTransferFromRoute({
      route: resolveRoute("map", query),
      store: {
        load(token) {
          return token === "county-story-token" ? context : null;
        },
        save() {
          throw new Error("save should not be called during county story round-trip read");
        },
      },
    });

    expect(roundTrip?.countyPowerStoryVisibility).toEqual(countyPowerStoryVisibility);
  });

  it("does not reset hidden county power story state when visible layers omit county story", () => {
    const calls = {
      countyPowerStoryThreeDimensionalEnabled: [] as boolean[],
      countyPowerStoryVisible: [] as Array<{ readonly storyId: string; readonly visible: boolean }>,
    };

    applyMapContextTransferToAppShell({
      context: {
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: "global-map",
        targetSurface: "global-map",
        visibleLayerIds: ["facilities.colocation"],
      },
      setBoundarySelectedRegionIds: () => undefined,
      setBoundaryVisible: () => undefined,
      setCountyPowerStoryThreeDimensionalEnabled: (enabled) => {
        calls.countyPowerStoryThreeDimensionalEnabled.push(enabled);
      },
      setCountyPowerStoryVisible: (storyId, visible) => {
        calls.countyPowerStoryVisible.push({ storyId, visible });
        return Promise.resolve();
      },
      setPerspectiveVisibility: () => undefined,
    });

    expect(calls.countyPowerStoryVisible).toEqual([]);
    expect(calls.countyPowerStoryThreeDimensionalEnabled).toEqual([]);
  });

  it("replays full county power story state in order through one async sequence", async () => {
    const calls: string[] = [];

    applyMapContextTransferToAppShell({
      context: {
        countyPowerStoryVisibility: {
          animationEnabled: false,
          chapterId: "policy-shockwaves",
          chapterVisible: false,
          seamHazeEnabled: true,
          storyId: "queue-pressure",
          threeDimensional: true,
          visible: false,
          window: "90d",
        },
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: "global-map",
        targetSurface: "global-map",
      },
      setBoundarySelectedRegionIds: () => undefined,
      setBoundaryVisible: () => undefined,
      setCountyPowerStoryAnimationEnabled: (enabled) => {
        calls.push(`animation:${enabled}`);
      },
      setCountyPowerStoryChapterId: (chapterId) => {
        calls.push(`chapter:${chapterId}`);
        return Promise.resolve();
      },
      setCountyPowerStoryChapterVisible: (visible) => {
        calls.push(`chapter-visible:${visible}`);
        return Promise.resolve();
      },
      setCountyPowerStorySeamHazeEnabled: (enabled) => {
        calls.push(`seam:${enabled}`);
      },
      setCountyPowerStoryStoryId: (storyId) => {
        calls.push(`story:${storyId}`);
        return Promise.resolve();
      },
      setCountyPowerStoryThreeDimensionalEnabled: (enabled) => {
        calls.push(`three-dimensional:${enabled}`);
      },
      setCountyPowerStoryVisible: (storyId, visible) => {
        calls.push(`visible:${storyId}:${visible}`);
        return Promise.resolve();
      },
      setCountyPowerStoryWindow: (window) => {
        calls.push(`window:${window}`);
        return Promise.resolve();
      },
      setPerspectiveVisibility: () => undefined,
    });

    await flushPromises();

    expect(calls).toEqual([
      "animation:false",
      "story:queue-pressure",
      "window:90d",
      "chapter:policy-shockwaves",
      "chapter-visible:false",
      "seam:true",
      "three-dimensional:true",
      "visible:queue-pressure:false",
    ]);
  });

  it("keeps the latest county power story replay when replays overlap", async () => {
    const firstStoryDeferred = createDeferred<void>();
    const state = {
      storyId: "grid-stress",
      visible: false,
      window: "live",
    };

    applyMapContextTransferToAppShell({
      context: {
        countyPowerStoryVisibility: {
          animationEnabled: true,
          chapterId: "operator-heartbeat",
          chapterVisible: true,
          seamHazeEnabled: false,
          storyId: "grid-stress",
          threeDimensional: false,
          visible: true,
          window: "live",
        },
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: "global-map",
        targetSurface: "global-map",
      },
      setBoundarySelectedRegionIds: () => undefined,
      setBoundaryVisible: () => undefined,
      setCountyPowerStoryAnimationEnabled: () => undefined,
      setCountyPowerStoryChapterId: () => Promise.resolve(),
      setCountyPowerStoryChapterVisible: () => Promise.resolve(),
      setCountyPowerStorySeamHazeEnabled: () => undefined,
      setCountyPowerStoryStoryId: (storyId) => {
        state.storyId = storyId;
        if (storyId === "grid-stress") {
          return firstStoryDeferred.promise;
        }

        return Promise.resolve();
      },
      setCountyPowerStoryThreeDimensionalEnabled: () => undefined,
      setCountyPowerStoryVisible: (storyId, visible) => {
        state.storyId = storyId;
        state.visible = visible;
        return Promise.resolve();
      },
      setCountyPowerStoryWindow: (window) => {
        state.window = window;
        return Promise.resolve();
      },
      setPerspectiveVisibility: () => undefined,
    });

    applyMapContextTransferToAppShell({
      context: {
        countyPowerStoryVisibility: {
          animationEnabled: true,
          chapterId: "policy-shockwaves",
          chapterVisible: true,
          seamHazeEnabled: false,
          storyId: "policy-watch",
          threeDimensional: false,
          visible: true,
          window: "90d",
        },
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: "global-map",
        targetSurface: "global-map",
      },
      setBoundarySelectedRegionIds: () => undefined,
      setBoundaryVisible: () => undefined,
      setCountyPowerStoryAnimationEnabled: () => undefined,
      setCountyPowerStoryChapterId: () => Promise.resolve(),
      setCountyPowerStoryChapterVisible: () => Promise.resolve(),
      setCountyPowerStorySeamHazeEnabled: () => undefined,
      setCountyPowerStoryStoryId: (storyId) => {
        state.storyId = storyId;
        return Promise.resolve();
      },
      setCountyPowerStoryThreeDimensionalEnabled: () => undefined,
      setCountyPowerStoryVisible: (storyId, visible) => {
        state.storyId = storyId;
        state.visible = visible;
        return Promise.resolve();
      },
      setCountyPowerStoryWindow: (window) => {
        state.window = window;
        return Promise.resolve();
      },
      setPerspectiveVisibility: () => undefined,
    });

    firstStoryDeferred.resolve(undefined);
    await flushPromises();

    expect(state).toEqual({
      storyId: "policy-watch",
      visible: true,
      window: "90d",
    });
  });

  it("applies perspective and boundary visibility without changing current UI-side behavior", () => {
    const calls = {
      basemapVisible: [] as Array<{ readonly layerId: string; readonly visible: boolean }>,
      boundarySelected: [] as Array<{
        readonly boundaryId: string;
        readonly regionIds: readonly string[] | null;
      }>,
      boundaryVisible: [] as Array<{ readonly boundaryId: string; readonly visible: boolean }>,
      fiberLayerVisible: [] as Array<{ readonly lineId: string; readonly visible: boolean }>,
      fiberSourceLayerSelection: [] as Array<{
        readonly lineId: string;
        readonly selectedLayerNames: readonly string[];
      }>,
      floodVisible: [] as Array<{ readonly layerId: string; readonly visible: boolean }>,
      hydroBasinsVisible: [] as boolean[],
      mapViewport: [] as unknown[],
      parcelsVisible: [] as boolean[],
      perspectiveViewMode: [] as Array<{ readonly perspective: string; readonly mode: string }>,
      perspectiveVisible: [] as Array<{ readonly perspective: string; readonly visible: boolean }>,
      powerVisible: [] as Array<{ readonly layerId: string; readonly visible: boolean }>,
      waterVisible: [] as boolean[],
    };

    applyMapContextTransferToAppShell({
      context: {
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: "global-map",
        targetSurface: "company-map",
        activePerspectives: ["colocation"],
        facilityViewModes: {
          colocation: "clusters",
          hyperscale: "dots",
        },
        visibleBasemapLayerIds: ["labels", "roads"],
        visibleLayerIds: [
          "environmental.flood-100",
          "fiber-locator.metro",
          "power.plants",
          "property.parcels",
          "environmental.water-features",
        ],
        selectedBoundaryIds: {
          county: ["48113"],
          state: ["tx"],
        },
        selectedFiberSourceLayerNames: {
          metro: ["att"],
        },
        viewport: {
          bearing: 12,
          center: [-96.8, 32.78],
          pitch: 40,
          type: "center",
          zoom: 9,
        },
      },
      setBasemapLayerVisible(layerId, visible) {
        calls.basemapVisible.push({ layerId, visible });
      },
      setBoundarySelectedRegionIds(boundaryId, selectedRegionIds) {
        calls.boundarySelected.push({ boundaryId, regionIds: selectedRegionIds });
      },
      setBoundaryVisible(boundaryId, visible) {
        calls.boundaryVisible.push({ boundaryId, visible });
      },
      setFiberLayerVisibility(lineId, visible) {
        calls.fiberLayerVisible.push({ lineId, visible });
      },
      setFiberSourceLayerSelection(lineId, selectedLayerNames) {
        calls.fiberSourceLayerSelection.push({ lineId, selectedLayerNames });
      },
      setFloodLayerVisible(layerId, visible) {
        calls.floodVisible.push({ layerId, visible });
      },
      setHydroBasinsVisible(visible) {
        calls.hydroBasinsVisible.push(visible);
      },
      setMapViewport(viewport) {
        calls.mapViewport.push(viewport);
      },
      setParcelsVisible(visible) {
        calls.parcelsVisible.push(visible);
      },
      setPerspectiveViewMode(perspective, mode) {
        calls.perspectiveViewMode.push({ perspective, mode });
      },
      setPerspectiveVisibility(perspective, visible) {
        calls.perspectiveVisible.push({ perspective, visible });
      },
      setPowerLayerVisible(layerId, visible) {
        calls.powerVisible.push({ layerId, visible });
      },
      setWaterVisible(visible) {
        calls.waterVisible.push(visible);
      },
    });

    expect(calls.mapViewport).toEqual([
      {
        bearing: 12,
        center: [-96.8, 32.78],
        pitch: 40,
        type: "center",
        zoom: 9,
      },
    ]);
    expect(calls.basemapVisible).toEqual([
      { layerId: "color", visible: false },
      { layerId: "globe", visible: false },
      { layerId: "satellite", visible: false },
      { layerId: "terrain", visible: false },
      { layerId: "landmarks", visible: false },
      { layerId: "labels", visible: true },
      { layerId: "roads", visible: true },
      { layerId: "boundaries", visible: false },
      { layerId: "buildings3d", visible: false },
    ]);
    expect(calls.perspectiveVisible).toEqual([
      { perspective: "colocation", visible: true },
      { perspective: "hyperscale", visible: false },
    ]);
    expect(calls.perspectiveViewMode).toEqual([
      { perspective: "colocation", mode: "clusters" },
      { perspective: "hyperscale", mode: "dots" },
    ]);
    expect(calls.fiberLayerVisible).toEqual([
      { lineId: "metro", visible: true },
      { lineId: "longhaul", visible: false },
    ]);
    expect(calls.fiberSourceLayerSelection).toEqual([
      { lineId: "metro", selectedLayerNames: ["att"] },
    ]);
    expect(calls.floodVisible).toEqual([
      { layerId: "flood100", visible: true },
      { layerId: "flood500", visible: false },
    ]);
    expect(calls.hydroBasinsVisible).toEqual([false]);
    expect(calls.powerVisible).toEqual([
      { layerId: "transmission", visible: false },
      { layerId: "substations", visible: false },
      { layerId: "plants", visible: true },
    ]);
    expect(calls.parcelsVisible).toEqual([true]);
    expect(calls.waterVisible).toEqual([true]);
    expect(calls.boundaryVisible).toEqual([
      { boundaryId: "state", visible: true },
      { boundaryId: "county", visible: true },
    ]);
    expect(calls.boundarySelected).toEqual([
      { boundaryId: "state", regionIds: ["tx"] },
      { boundaryId: "county", regionIds: ["48113"] },
    ]);
  });
});
