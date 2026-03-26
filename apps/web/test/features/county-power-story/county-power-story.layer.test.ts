import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CountyPowerStoryRow } from "@map-migration/http-contracts/county-power-story-http";
import {
  COUNTY_POWER_STORY_TILE_PROMOTE_ID,
  COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
} from "@map-migration/http-contracts/county-power-story-http";
import type { MapRenderedFeature } from "@map-migration/map-engine";
import { Effect } from "effect";
import { shallowRef } from "vue";
import { FakeMap } from "../../support/fake-map";

mock.restore();

const fetchCountyPowerStorySnapshotMock =
  mock<
    (
      storyId: "grid-stress" | "market-structure" | "policy-watch" | "queue-pressure",
      options?: {
        readonly publicationRunId?: string | undefined;
        readonly window?: "30d" | "60d" | "90d" | "live" | undefined;
      }
    ) => Promise<{
      readonly data: {
        readonly dataVersion: string | null;
        readonly formulaVersion: string | null;
        readonly inputDataVersion: string | null;
        readonly publicationRunId: string | null;
        readonly publishedAt: string | null;
        readonly rows: readonly CountyPowerStoryRow[];
        readonly storyId: "grid-stress" | "market-structure" | "policy-watch" | "queue-pressure";
        readonly window: "30d" | "60d" | "90d" | "live";
      };
      readonly ok: true;
      readonly requestId: string;
    }>
  >();
const fetchCountyPowerStoryGeometryMock =
  mock<
    () => Promise<{
      readonly data: {
        readonly features: readonly Array<{
          readonly geometry: GeoJSON.Geometry;
          readonly id: string;
          readonly properties: {
            readonly centroid: readonly [number, number];
            readonly countyFips: string;
            readonly countyName: string | null;
            readonly stateAbbrev: string | null;
          };
          readonly type: "Feature";
        }>;
        readonly meta: {
          readonly dataVersion: string;
          readonly recordCount: number;
          readonly requestId: string;
          readonly sourceMode: string;
        };
        readonly type: "FeatureCollection";
      };
      readonly ok: true;
      readonly requestId: string;
    }>
  >();
const fetchCountyPowerStoryTimelineMock =
  mock<
    () => Promise<{
      readonly data: {
        readonly dataVersion: string | null;
        readonly formulaVersion: string | null;
        readonly frames: readonly Array<{
          readonly rows: readonly Array<{
            readonly activityScore: number;
            readonly band: "baseline" | "elevated" | "high" | "extreme";
            readonly categoryKey: string | null;
            readonly countyFips: string;
            readonly direction: "cool" | "warm" | "mixed" | "watch" | "neutral";
            readonly normalizedScore: number;
            readonly outlineIntensity: number;
            readonly pulseAmplitude: number;
            readonly seed: number;
          }>;
          readonly window: "30d" | "60d" | "90d" | "live";
        }>;
        readonly inputDataVersion: string | null;
        readonly meta: {
          readonly dataVersion: string;
          readonly recordCount: number;
          readonly requestId: string;
          readonly sourceMode: string;
        };
        readonly publicationRunId: string | null;
        readonly publishedAt: string | null;
        readonly storyId: "queue-pressure";
      };
      readonly ok: true;
      readonly requestId: string;
    }>
  >();
const fetchCountyScoresStatusMock =
  mock<
    () => Promise<{
      readonly data: { readonly publicationRunId: string | null };
      readonly ok: true;
      readonly requestId: string;
    }>
  >();

mock.module("../../../src/features/county-power-story/county-power-story.api", () => ({
  fetchCountyPowerStoryGeometry: fetchCountyPowerStoryGeometryMock,
  fetchCountyPowerStorySnapshot: fetchCountyPowerStorySnapshotMock,
  fetchCountyPowerStoryTimeline: fetchCountyPowerStoryTimelineMock,
  readCountyPowerStoryVectorTileTemplate: () =>
    "https://app.example.com/api/geo/county-power/story/tiles/{z}/{x}/{y}",
}));

mock.module("../../../src/features/county-intelligence/county-intelligence.api", () => ({
  fetchCountyScoresStatus: fetchCountyScoresStatusMock,
}));

mock.module("../../../src/features/market-boundaries/api", () => ({
  fetchMarketBoundariesEffect: (level: "market" | "submarket") =>
    Effect.succeed({
      ok: true,
      requestId: level,
      data: {
        features:
          level === "market"
            ? [
                {
                  type: "Feature",
                  id: "ercot-market",
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [-100, 29],
                        [-95, 29],
                        [-95, 33],
                        [-100, 33],
                        [-100, 29],
                      ],
                    ],
                  },
                  properties: {
                    absorption: 0.42,
                    commissionedPowerMw: 1200,
                    level: "market",
                    marketId: "ERCOT",
                    parentRegionName: null,
                    regionId: "ercot",
                    regionName: "ERCOT",
                    vacancy: 0.18,
                  },
                },
              ]
            : [
                {
                  type: "Feature",
                  id: "ercot-submarket",
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [-99, 30],
                        [-97, 30],
                        [-97, 32],
                        [-99, 32],
                        [-99, 30],
                      ],
                    ],
                  },
                  properties: {
                    absorption: 0.38,
                    commissionedPowerMw: 780,
                    level: "submarket",
                    marketId: "ERCOT",
                    parentRegionName: "ERCOT",
                    regionId: "ercot-central",
                    regionName: "ERCOT Central",
                    vacancy: 0.14,
                  },
                },
              ],
        meta: {
          dataVersion: "2026-03-23",
          recordCount: 1,
          requestId: level,
          sourceMode: "live",
        },
        type: "FeatureCollection",
      },
    }),
}));

const { mountCountyPowerStoryLayer } = await import(
  "../../../src/features/county-power-story/county-power-story.layer.ts?county-power-story-layer-test"
);
const { useAppShellVisibility } = await import(
  "../../../src/features/app/visibility/use-app-shell-visibility.ts?county-power-story-layer-test"
);
const { createLayerRuntime } = await import(
  "../../../src/features/layers/layer-runtime.service.ts?county-power-story-layer-test"
);
const {
  countyPowerStoryCatalogLayerIds,
  countyPowerStoryStyleLayerIds,
  defaultCountyPowerStoryChapterId,
} = await import(
  "../../../src/features/county-power-story/county-power-story.service.ts?county-power-story-layer-test"
);

const originalRequestAnimationFrame = Reflect.get(globalThis, "requestAnimationFrame");
const originalCancelAnimationFrame = Reflect.get(globalThis, "cancelAnimationFrame");

function createMap(zoom = 5) {
  return new FakeMap({
    zoom,
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "county-labels",
          type: "symbol",
          source: "basemap",
          layout: {
            "text-field": ["get", "name"],
          },
        },
      ],
    },
  });
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
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function createStoryRow(): CountyPowerStoryRow {
  return {
    countyFips: "48453",
    countyName: "Travis County",
    stateAbbrev: "TX",
    avgRtCongestionComponent: 4.8,
    isSeamCounty: false,
    marketStructure: "organized_market",
    moratoriumStatus: "watch",
    negativePriceHourShare: 0.06,
    p95ShadowPrice: 29.4,
    policyEventCount: 4,
    policyMomentumScore: 12.5,
    queueAvgAgeDays: 550,
    queueMwActive: 480,
    queueProjectCountActive: 11,
    wholesaleOperator: "ERCOT",
    activityScore: 0.62,
    band: "high",
    categoryKey: "warm",
    direction: "warm",
    normalizedScore: 0.74,
    outlineIntensity: 0.53,
    pulseAmplitude: 0.67,
    seed: 0.31,
  };
}

describe("county power story layer", () => {
  beforeEach(() => {
    fetchCountyPowerStorySnapshotMock.mockReset();
    fetchCountyPowerStoryGeometryMock.mockReset();
    fetchCountyPowerStoryTimelineMock.mockReset();
    fetchCountyScoresStatusMock.mockReset();

    Reflect.set(globalThis, "requestAnimationFrame", () => 1);
    Reflect.set(globalThis, "cancelAnimationFrame", () => undefined);

    fetchCountyPowerStorySnapshotMock.mockImplementation(async (storyId, options = {}) => ({
      ok: true,
      requestId: "snapshot",
      data: {
        dataVersion: "2026-03-23",
        formulaVersion: "county-market-pressure-v2",
        inputDataVersion: "county-market-pressure-public-us-20260323t224500z",
        publicationRunId: "county-market-pressure-county-power-public-us-20260323t224500z",
        publishedAt: "2026-03-23T22:45:00.000Z",
        rows: [createStoryRow()],
        storyId,
        window: options.window ?? "live",
      },
    }));
    fetchCountyPowerStoryGeometryMock.mockResolvedValue({
      ok: true,
      requestId: "geometry",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "48453",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-98, 30],
                  [-97, 30],
                  [-97, 31],
                  [-98, 31],
                  [-98, 30],
                ],
              ],
            },
            properties: {
              centroid: [-97.7431, 30.2672],
              countyFips: "48453",
              countyName: "Travis County",
              stateAbbrev: "TX",
            },
          },
        ],
        meta: {
          dataVersion: "2026-03-23",
          recordCount: 1,
          requestId: "geometry",
          sourceMode: "live",
        },
      },
    });
    fetchCountyPowerStoryTimelineMock.mockResolvedValue({
      ok: true,
      requestId: "timeline",
      data: {
        dataVersion: "2026-03-23",
        formulaVersion: "county-market-pressure-v2",
        inputDataVersion: "county-market-pressure-public-us-20260323t224500z",
        meta: {
          dataVersion: "2026-03-23",
          recordCount: 4,
          requestId: "timeline",
          sourceMode: "live",
        },
        publicationRunId: "county-market-pressure-county-power-public-us-20260323t224500z",
        publishedAt: "2026-03-23T22:45:00.000Z",
        storyId: "queue-pressure",
        frames: (["live", "30d", "60d", "90d"] as const).map((window) => ({
          window,
          rows: [
            {
              activityScore: 0.62,
              band: "high",
              categoryKey: "solar",
              countyFips: "48453",
              direction: "warm",
              normalizedScore: 0.74,
              outlineIntensity: 0.53,
              pulseAmplitude: 0.67,
              seed: 0.31,
            },
          ],
        })),
      },
    });
    fetchCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      requestId: "status",
      data: {
        publicationRunId: "county-market-pressure-county-power-public-us-20260323t224500z",
      },
    });
  });

  afterAll(() => {
    if (typeof originalRequestAnimationFrame === "function") {
      Reflect.set(globalThis, "requestAnimationFrame", originalRequestAnimationFrame);
    }
    if (typeof originalCancelAnimationFrame === "function") {
      Reflect.set(globalThis, "cancelAnimationFrame", originalCancelAnimationFrame);
    }

    mock.restore();
  });

  it("does not fetch snapshots while hidden state is being restored", async () => {
    const map = createMap();
    const mounted = mountCountyPowerStoryLayer(map);

    try {
      map.emit("load");

      await mounted.controller.setStoryId("queue-pressure");
      await mounted.controller.setWindow("60d");

      expect(fetchCountyPowerStorySnapshotMock).not.toHaveBeenCalled();
    } finally {
      mounted.destroy();
    }
  });

  it("registers a vector tile source and fetches exactly once for the intended story and window", async () => {
    const map = createMap();
    const mounted = mountCountyPowerStoryLayer(map);

    try {
      map.emit("load");

      await mounted.controller.setStoryId("queue-pressure");
      await mounted.controller.setWindow("60d");
      await mounted.controller.setVisible(true);

      expect(map.addedSources.get("county-power-story.source")).toMatchObject({
        type: "vector",
        tiles: ["https://app.example.com/api/geo/county-power/story/tiles/{z}/{x}/{y}"],
        promoteId: COUNTY_POWER_STORY_TILE_PROMOTE_ID,
        maxzoom: 12,
      });
      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledTimes(1);
      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledWith("queue-pressure", {
        window: "60d",
      });
    } finally {
      mounted.destroy();
    }
  });

  it("projects only render-focused properties into feature-state", async () => {
    const map = createMap();
    const mounted = mountCountyPowerStoryLayer(map);

    try {
      map.emit("load");

      await mounted.controller.setStoryId("market-structure");
      await mounted.controller.setVisible(true);

      const latestFeatureStateCall = map.featureStateCalls.findLast(
        (call) =>
          call.target.source === "county-power-story.source" && String(call.target.id) === "48453"
      );
      const state = latestFeatureStateCall?.state;

      expect(latestFeatureStateCall?.target.sourceLayer).toBe(COUNTY_POWER_STORY_TILE_SOURCE_LAYER);
      expect(state).toMatchObject({
        marketStructure: "organized_market",
        normalizedScore: 0.74,
        outlineIntensity: 0.53,
        pulseAmplitude: 0.67,
        previousNormalizedScore: 0.74,
      });
      expect(Reflect.has(state ?? {}, "queueMwActive")).toBe(false);
      expect(Reflect.has(state ?? {}, "policyMomentumScore")).toBe(false);
      expect(Reflect.has(state ?? {}, "wholesaleOperator")).toBe(false);
    } finally {
      mounted.destroy();
    }
  });

  it("evicts stale snapshot cache entries once the cache cap is exceeded", async () => {
    const map = createMap();
    const mounted = mountCountyPowerStoryLayer(map);

    try {
      map.emit("load");

      await mounted.controller.setVisible(true);
      await mounted.controller.setWindow("30d");
      await mounted.controller.setWindow("60d");
      await mounted.controller.setWindow("90d");
      await mounted.controller.setStoryId("queue-pressure");

      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledTimes(5);

      await mounted.controller.setStoryId("grid-stress");

      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledTimes(5);

      await mounted.controller.setWindow("live");

      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledTimes(6);
      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenLastCalledWith("grid-stress", {
        window: "live",
      });
    } finally {
      mounted.destroy();
    }
  });

  it("shows the active story layer immediately when toggled through app-shell visibility", async () => {
    const map = createMap();
    const mounted = mountCountyPowerStoryLayer(map);
    const layerRuntime = createLayerRuntime(map, {
      initialUserVisibleLayerIds: [],
    });
    const visibility = useAppShellVisibility({
      basemapLayerController: shallowRef(null),
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clearCountyPowerStoryHover: () => undefined,
      clearPowerHover: () => undefined,
      clearSelectedCountyPowerStory: () => undefined,
      clearSelectedParcel: () => undefined,
      countyPowerStoryController: shallowRef(mounted),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: true,
        chapterId: "operator-heartbeat",
        chapterVisible: true,
        seamHazeEnabled: false,
        storyId: "grid-stress",
        threeDimensional: false,
        visible: false,
        window: "live",
      }),
      gasPipelineController: shallowRef(null),
      layerRuntime: shallowRef(layerRuntime),
      setViewportFacilities: () => undefined,
    });

    try {
      for (const layerId of countyPowerStoryCatalogLayerIds()) {
        layerRuntime.registerLayerController(layerId, mounted.controllers[layerId]);
      }

      map.emit("load");
      await visibility.setCountyPowerStoryVisible("grid-stress", true);

      const fillLayerId = countyPowerStoryStyleLayerIds("grid-stress").fillLayerId;
      const latestVisibilityCall = map.layerVisibilityCalls.findLast(
        (call) => call.layerId === fillLayerId
      );

      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledTimes(1);
      expect(latestVisibilityCall?.visible).toBe(true);
    } finally {
      layerRuntime.destroy();
      mounted.destroy();
    }
  });

  it("keeps only the latest county power story visibility request when setter calls race", async () => {
    const runtimeVisibility = new Map<string, boolean>();
    const firstStoryDeferred = createDeferred<void>();
    const storyCalls: string[] = [];
    const visibility = useAppShellVisibility({
      basemapLayerController: shallowRef(null),
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clearCountyPowerStoryHover: () => undefined,
      clearPowerHover: () => undefined,
      clearSelectedCountyPowerStory: () => undefined,
      clearSelectedParcel: () => undefined,
      countyPowerStoryController: shallowRef({
        controller: {
          destroy: () => undefined,
          setAnimationEnabled: () => undefined,
          setChapterId: async () => undefined,
          setChapterVisible: async () => undefined,
          setSeamHazeEnabled: () => undefined,
          setSelectedCounty: () => undefined,
          setStoryId: async (storyId) => {
            storyCalls.push(storyId);
            if (storyCalls.length === 1) {
              await firstStoryDeferred.promise;
            }
          },
          setThreeDimensionalEnabled: () => undefined,
          setVisibilityManagedByRuntime: () => undefined,
          setVisible: () => Promise.resolve(),
          setWindow: async () => undefined,
        },
        controllers: {
          "models.county-power-3d": {
            destroy: () => undefined,
            layerId: "models.county-power-3d",
            setVisible: () => undefined,
          },
          "models.county-power-grid-stress": {
            destroy: () => undefined,
            layerId: "models.county-power-grid-stress",
            setVisible: () => undefined,
          },
          "models.county-power-market-structure": {
            destroy: () => undefined,
            layerId: "models.county-power-market-structure",
            setVisible: () => undefined,
          },
          "models.county-power-policy-watch": {
            destroy: () => undefined,
            layerId: "models.county-power-policy-watch",
            setVisible: () => undefined,
          },
          "models.county-power-queue-pressure": {
            destroy: () => undefined,
            layerId: "models.county-power-queue-pressure",
            setVisible: () => undefined,
          },
        },
        destroy: () => undefined,
        status: { state: "ready" },
      }),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: true,
        chapterId: "operator-heartbeat",
        chapterVisible: true,
        seamHazeEnabled: false,
        storyId: "grid-stress",
        threeDimensional: false,
        visible: true,
        window: "live",
      }),
      gasPipelineController: shallowRef(null),
      layerRuntime: shallowRef({
        destroy: () => undefined,
        getEffectiveVisible: () => false,
        getUserVisible: () => false,
        registerLayerController: () => undefined,
        setStressBlocked: () => undefined,
        setUserVisible: (layerId, visible) => {
          runtimeVisibility.set(layerId, visible);
        },
        unregisterLayerController: () => undefined,
      }),
      setViewportFacilities: () => undefined,
    });

    const staleRequest = visibility.setCountyPowerStoryVisible("grid-stress", false);
    const latestRequest = visibility.setCountyPowerStoryVisible("queue-pressure", true);

    firstStoryDeferred.resolve(undefined);
    await staleRequest;
    await latestRequest;

    expect(storyCalls.at(-1)).toBe("queue-pressure");
    expect(runtimeVisibility.get("models.county-power-grid-stress")).toBe(false);
    expect(runtimeVisibility.get("models.county-power-queue-pressure")).toBe(true);
    expect(visibility.countyPowerStoryVisibility.value).toMatchObject({
      chapterId: "queue-pressure-storm",
      storyId: "queue-pressure",
      visible: true,
    });
  });

  it("switches to the story default chapter when changing county power stories", async () => {
    const visibility = useAppShellVisibility({
      basemapLayerController: shallowRef(null),
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clearCountyPowerStoryHover: () => undefined,
      clearPowerHover: () => undefined,
      clearSelectedCountyPowerStory: () => undefined,
      clearSelectedParcel: () => undefined,
      countyPowerStoryController: shallowRef(null),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: true,
        chapterId: "queue-pressure-storm",
        chapterVisible: true,
        seamHazeEnabled: false,
        storyId: "queue-pressure",
        threeDimensional: false,
        visible: true,
        window: "live",
      }),
      gasPipelineController: shallowRef(null),
      layerRuntime: shallowRef(null),
      setViewportFacilities: () => undefined,
    });

    await visibility.setCountyPowerStoryVisible("grid-stress", true);

    expect(visibility.countyPowerStoryVisibility.value).toMatchObject({
      chapterId: defaultCountyPowerStoryChapterId("grid-stress"),
      storyId: "grid-stress",
      visible: true,
    });
  });

  it("keeps the current story id when county power story visibility is turned off", async () => {
    const runtimeVisibility = new Map<string, boolean>();
    const storyCalls: string[] = [];
    const visibility = useAppShellVisibility({
      basemapLayerController: shallowRef(null),
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clearCountyPowerStoryHover: () => undefined,
      clearPowerHover: () => undefined,
      clearSelectedCountyPowerStory: () => undefined,
      clearSelectedParcel: () => undefined,
      countyPowerStoryController: shallowRef({
        controller: {
          destroy: () => undefined,
          setAnimationEnabled: () => undefined,
          setChapterId: async () => undefined,
          setChapterVisible: async () => undefined,
          setSeamHazeEnabled: () => undefined,
          setSelectedCounty: () => undefined,
          setStoryId: (storyId) => {
            storyCalls.push(storyId);
            return Promise.resolve();
          },
          setThreeDimensionalEnabled: () => undefined,
          setVisibilityManagedByRuntime: () => undefined,
          setVisible: () => Promise.resolve(),
          setWindow: async () => undefined,
        },
        controllers: {
          "models.county-power-3d": {
            destroy: () => undefined,
            layerId: "models.county-power-3d",
            setVisible: () => undefined,
          },
          "models.county-power-grid-stress": {
            destroy: () => undefined,
            layerId: "models.county-power-grid-stress",
            setVisible: () => undefined,
          },
          "models.county-power-market-structure": {
            destroy: () => undefined,
            layerId: "models.county-power-market-structure",
            setVisible: () => undefined,
          },
          "models.county-power-policy-watch": {
            destroy: () => undefined,
            layerId: "models.county-power-policy-watch",
            setVisible: () => undefined,
          },
          "models.county-power-queue-pressure": {
            destroy: () => undefined,
            layerId: "models.county-power-queue-pressure",
            setVisible: () => undefined,
          },
        },
        destroy: () => undefined,
        status: { state: "ready" },
      }),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: true,
        chapterId: "operator-heartbeat",
        chapterVisible: true,
        seamHazeEnabled: false,
        storyId: "queue-pressure",
        threeDimensional: false,
        visible: true,
        window: "live",
      }),
      gasPipelineController: shallowRef(null),
      layerRuntime: shallowRef({
        destroy: () => undefined,
        getEffectiveVisible: () => false,
        getUserVisible: () => false,
        registerLayerController: () => undefined,
        setStressBlocked: () => undefined,
        setUserVisible: (layerId, visible) => {
          runtimeVisibility.set(layerId, visible);
        },
        unregisterLayerController: () => undefined,
      }),
      setViewportFacilities: () => undefined,
    });

    await visibility.setCountyPowerStoryVisible("grid-stress", false);

    expect(storyCalls.at(-1)).toBe("queue-pressure");
    expect(runtimeVisibility.get("models.county-power-grid-stress")).toBe(false);
    expect(runtimeVisibility.get("models.county-power-queue-pressure")).toBe(false);
    expect(visibility.countyPowerStoryVisibility.value).toMatchObject({
      storyId: "queue-pressure",
      visible: false,
    });
  });

  it("stays on the latest story when a stale replay arrives after a local model switch", async () => {
    const map = createMap();
    const mounted = mountCountyPowerStoryLayer(map);
    const layerRuntime = createLayerRuntime(map, {
      initialUserVisibleLayerIds: [],
    });
    const firstStoryDeferred = createDeferred<void>();
    let shouldDeferGridStress = true;
    const visibility = useAppShellVisibility({
      basemapLayerController: shallowRef(null),
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clearCountyPowerStoryHover: () => undefined,
      clearPowerHover: () => undefined,
      clearSelectedCountyPowerStory: () => undefined,
      clearSelectedParcel: () => undefined,
      countyPowerStoryController: shallowRef({
        controller: {
          destroy: mounted.controller.destroy,
          setAnimationEnabled: mounted.controller.setAnimationEnabled,
          setChapterId: mounted.controller.setChapterId,
          setChapterVisible: mounted.controller.setChapterVisible,
          setSeamHazeEnabled: mounted.controller.setSeamHazeEnabled,
          setSelectedCounty: mounted.controller.setSelectedCounty,
          setStoryId: async (storyId) => {
            if (storyId === "grid-stress" && shouldDeferGridStress) {
              shouldDeferGridStress = false;
              await firstStoryDeferred.promise;
            }

            await mounted.controller.setStoryId(storyId);
          },
          setThreeDimensionalEnabled: mounted.controller.setThreeDimensionalEnabled,
          setVisibilityManagedByRuntime: mounted.controller.setVisibilityManagedByRuntime,
          setVisible: mounted.controller.setVisible,
          setWindow: mounted.controller.setWindow,
        },
        controllers: mounted.controllers,
        destroy: mounted.destroy,
        status: mounted.status,
      }),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: true,
        chapterId: "operator-heartbeat",
        chapterVisible: true,
        seamHazeEnabled: false,
        storyId: "grid-stress",
        threeDimensional: false,
        visible: false,
        window: "live",
      }),
      gasPipelineController: shallowRef(null),
      layerRuntime: shallowRef(layerRuntime),
      setViewportFacilities: () => undefined,
    });

    try {
      for (const layerId of countyPowerStoryCatalogLayerIds()) {
        layerRuntime.registerLayerController(layerId, mounted.controllers[layerId]);
      }

      map.emit("load");

      const staleReplay = visibility.setCountyPowerStoryVisible("grid-stress", true);
      const latestSwitch = visibility.setCountyPowerStoryVisible("policy-watch", true);

      firstStoryDeferred.resolve(undefined);
      await staleReplay;
      await latestSwitch;

      const gridStressFillLayerId = countyPowerStoryStyleLayerIds("grid-stress").fillLayerId;
      const policyWatchFillLayerId = countyPowerStoryStyleLayerIds("policy-watch").fillLayerId;
      const latestGridStressVisibility = map.layerVisibilityCalls.findLast(
        (call) => call.layerId === gridStressFillLayerId
      );
      const latestPolicyWatchVisibility = map.layerVisibilityCalls.findLast(
        (call) => call.layerId === policyWatchFillLayerId
      );

      expect(visibility.countyPowerStoryVisibility.value).toMatchObject({
        storyId: "policy-watch",
        visible: true,
      });
      expect(latestGridStressVisibility?.visible).toBe(false);
      expect(latestPolicyWatchVisibility?.visible).toBe(true);
    } finally {
      layerRuntime.destroy();
      mounted.destroy();
    }
  });

  it("keeps county power stories visible at national zoom when enabled", async () => {
    const map = createMap(3.2);
    const mounted = mountCountyPowerStoryLayer(map);
    const layerRuntime = createLayerRuntime(map, {
      initialUserVisibleLayerIds: [],
    });
    const visibility = useAppShellVisibility({
      basemapLayerController: shallowRef(null),
      boundaryControllers: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      boundaryFacetSelection: shallowRef({
        country: null,
        county: null,
        state: null,
      }),
      clearCountyPowerStoryHover: () => undefined,
      clearPowerHover: () => undefined,
      clearSelectedCountyPowerStory: () => undefined,
      clearSelectedParcel: () => undefined,
      countyPowerStoryController: shallowRef(mounted),
      countyPowerStoryVisibility: shallowRef({
        animationEnabled: true,
        chapterId: "operator-heartbeat",
        chapterVisible: true,
        seamHazeEnabled: false,
        storyId: "grid-stress",
        threeDimensional: false,
        visible: false,
        window: "live",
      }),
      gasPipelineController: shallowRef(null),
      layerRuntime: shallowRef(layerRuntime),
      setViewportFacilities: () => undefined,
    });

    try {
      for (const layerId of countyPowerStoryCatalogLayerIds()) {
        layerRuntime.registerLayerController(layerId, mounted.controllers[layerId]);
      }

      map.emit("load");
      await visibility.setCountyPowerStoryVisible("grid-stress", true);

      const fillLayerId = countyPowerStoryStyleLayerIds("grid-stress").fillLayerId;
      const latestLowZoomVisibility = map.layerVisibilityCalls.findLast(
        (call) => call.layerId === fillLayerId
      );

      expect(fetchCountyPowerStorySnapshotMock).toHaveBeenCalledTimes(1);
      expect(latestLowZoomVisibility?.visible).toBe(true);

      visibility.setCountyPowerStoryThreeDimensionalEnabled(true);
      await flushPromises();

      const extrusionLayerId = "models.county-power-3d.fill-extrusion";
      const latestLowZoomExtrusionVisibility = map.layerVisibilityCalls.findLast(
        (call) => call.layerId === extrusionLayerId
      );

      expect(latestLowZoomExtrusionVisibility?.visible).toBe(true);

      map.setZoom(5);
      map.emit("moveend");

      const latestLocalExtrusionVisibility = map.layerVisibilityCalls.findLast(
        (call) => call.layerId === extrusionLayerId
      );

      expect(latestLocalExtrusionVisibility?.visible).toBe(true);
    } finally {
      layerRuntime.destroy();
      mounted.destroy();
    }
  });

  it("clears county hover when a higher-priority facilities hover is active", async () => {
    const map = createMap();
    const hoverChanges: unknown[] = [];
    let hoverSuppressed = false;
    const mounted = mountCountyPowerStoryLayer(map, {
      isHoverSuppressed: () => hoverSuppressed,
      onHoverChange: (nextHover) => {
        hoverChanges.push(nextHover);
      },
    });
    const feature: MapRenderedFeature = {
      id: "48453",
      geometry: {
        type: "Polygon",
        coordinates: [],
      },
      properties: {
        countyFips: "48453",
      },
    };
    map.queryRenderedFeatures = () => [feature];

    try {
      map.emit("load");
      await mounted.controller.setVisible(true);

      const pointerMoveHandler = Array.from(map.pointerMoveHandlers)[0];
      expect(pointerMoveHandler).toBeDefined();
      if (typeof pointerMoveHandler === "undefined") {
        return;
      }

      pointerMoveHandler({
        buttons: 0,
        lngLat: {
          lng: -97.7431,
          lat: 30.2672,
        },
        point: [12, 18],
      });

      expect(hoverChanges.at(-1)).toMatchObject({
        row: expect.objectContaining({
          countyFips: "48453",
        }),
      });

      hoverSuppressed = true;
      pointerMoveHandler({
        buttons: 0,
        lngLat: {
          lng: -97.7431,
          lat: 30.2672,
        },
        point: [12, 18],
      });

      expect(hoverChanges.at(-1)).toBeNull();
      expect(map.featureStateCalls).toContainEqual({
        state: { hover: false },
        target: {
          id: "48453",
          source: "county-power-story.source",
          sourceLayer: COUNTY_POWER_STORY_TILE_SOURCE_LAYER,
        },
      });
    } finally {
      mounted.destroy();
    }
  });

  it("anchors county power layers below facilities render layers when facilities are present", async () => {
    const map = new FakeMap({
      zoom: 5,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "facilities.colocation.points",
            type: "circle",
            source: "facilities.colocation",
          },
          {
            id: "county-labels",
            type: "symbol",
            source: "basemap",
            layout: {
              "text-field": ["get", "name"],
            },
          },
        ],
      },
    });
    const mounted = mountCountyPowerStoryLayer(map);

    try {
      map.emit("load");
      await mounted.controller.setVisible(true);
      await mounted.controller.setChapterId("queue-pressure-storm");

      expect(map.addedLayers.get("models.county-power-grid-stress.fill")?.beforeId).toBe(
        "facilities.colocation.points"
      );
      expect(map.addedLayers.get("county-power-story.chapter.queue-heat")?.beforeId).toBe(
        "facilities.colocation.points"
      );
    } finally {
      mounted.destroy();
    }
  });
});
