import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Effect } from "effect";
import { computed, effectScope, reactive, shallowRef } from "vue";
import type { LocationQueryRaw } from "vue-router";
import type { UseAppShellUrlStateOptions } from "@/features/app/core/app-shell-url-state.types";
import { createDefaultMapFiltersState } from "@/features/app/filters/map-filters.types";
import { FakeMap } from "../../../support/fake-map";

mock.restore();

interface MockRouteState {
  query: LocationQueryRaw;
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

function serializeQuery(query: LocationQueryRaw): string {
  const sortedEntries = Object.entries(query).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );

  return JSON.stringify(sortedEntries);
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

async function waitForUrlSyncWindow(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 220));
  await flushPromises();
}

const route = reactive<MockRouteState>({
  query: {},
});
const replaceRequests: Array<{
  readonly deferred: ReturnType<typeof createDeferred<void>>;
  readonly query: LocationQueryRaw;
}> = [];
const routerReplaceMock = mock(({ query }: { readonly query: LocationQueryRaw }) => {
  const deferred = createDeferred<void>();
  replaceRequests.push({ deferred, query });
  return deferred.promise;
});
const applyMapContextTransferToAppShellMock = mock();

mock.module("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
}));

mock.module("@/composables/use-debounced-latest-effect-task", () => ({
  useDebouncedLatestEffectTask: () => ({
    clear: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
    run: (program: Effect.Effect<void, unknown, never>) => Effect.runPromise(program),
    start: (program: Effect.Effect<void, unknown, never>) => Effect.runPromise(program),
  }),
}));

mock.module("../../../../src/features/app/core/app-shell-url-state.service", () => ({
  buildAppShellUrlStateQuery: (
    options: Pick<UseAppShellUrlStateOptions, "countyPowerStoryVisibility">,
    currentQuery: LocationQueryRaw,
    preferredContextToken?: string
  ) => ({
    mapContextToken:
      preferredContextToken ??
      (typeof currentQuery.mapContextToken === "string" ? currentQuery.mapContextToken : "token"),
    storyId: options.countyPowerStoryVisibility.value.storyId,
  }),
  createSelfAuthoredQuerySignatureRegistry: () => {
    const signatures = new Set<string>();

    return {
      add(signature: string) {
        signatures.add(signature);
      },
      clear(signature: string) {
        signatures.delete(signature);
      },
      consume(signature: string) {
        if (!signatures.has(signature)) {
          return false;
        }

        signatures.delete(signature);
        return true;
      },
      has(signature: string) {
        return signatures.has(signature);
      },
    };
  },
  serializeNormalizedMapContextQuery: serializeQuery,
}));

mock.module("../../../../src/features/map-context-transfer/map-context-transfer.service", () => ({
  applyMapContextTransferToAppShell: applyMapContextTransferToAppShellMock,
  readMapContextTransferFromRoute: ({ route: nextRoute }: { readonly route: MockRouteState }) => ({
    query: nextRoute.query,
  }),
  readMapContextTransferTokenFromQuery: (query: LocationQueryRaw) =>
    typeof query.mapContextToken === "string" ? query.mapContextToken : null,
}));

const { useAppShellUrlState } = await import(
  "../../../../src/features/app/core/use-app-shell-url-state.ts?use-app-shell-url-state-test"
);

function createOptions(): UseAppShellUrlStateOptions {
  return {
    basemapVisibility: shallowRef({
      boundaries: false,
      buildings3d: false,
      color: true,
      globe: false,
      labels: true,
      landmarks: false,
      roads: true,
      satellite: false,
      terrain: false,
    }),
    boundaryFacetSelection: shallowRef({
      country: null,
      county: null,
      state: null,
    }),
    boundaryVisibility: shallowRef({
      country: false,
      county: false,
      state: false,
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
    currentSurface: computed(() => "global-map"),
    fiberVisibility: shallowRef({
      longhaul: false,
      metro: false,
    }),
    floodVisibility: shallowRef({
      flood100: false,
      flood500: false,
    }),
    gasPipelineVisible: shallowRef(false),
    hydroBasinsVisible: shallowRef(false),
    interactionCoordinator: shallowRef(null),
    layerRuntimeSnapshot: shallowRef(null),
    map: shallowRef(new FakeMap()),
    mapFilters: shallowRef(createDefaultMapFiltersState()),
    parcelsVisible: shallowRef(false),
    perspectiveViewModes: shallowRef({
      colocation: "dots",
      hyperscale: "dots",
    }),
    powerVisibility: shallowRef({
      plants: false,
      substations: false,
      transmission: false,
    }),
    selectedFiberSourceLayerNames: shallowRef({
      longhaul: [],
      metro: [],
    }),
    setBasemapLayerVisible: () => undefined,
    setBoundarySelectedRegionIds: () => undefined,
    setBoundaryVisible: () => undefined,
    setCountyPowerStoryAnimationEnabled: () => undefined,
    setCountyPowerStoryChapterId: () => Promise.resolve(),
    setCountyPowerStoryChapterVisible: () => Promise.resolve(),
    setCountyPowerStorySeamHazeEnabled: () => undefined,
    setCountyPowerStoryStoryId: () => Promise.resolve(),
    setCountyPowerStoryThreeDimensionalEnabled: () => undefined,
    setCountyPowerStoryVisible: () => Promise.resolve(),
    setCountyPowerStoryWindow: () => Promise.resolve(),
    setFiberLayerVisibility: () => undefined,
    setFiberSourceLayerSelection: () => undefined,
    setFloodLayerVisible: () => undefined,
    setGasPipelineVisible: () => undefined,
    setHydroBasinsVisible: () => undefined,
    setMapFiltersState: () => undefined,
    setParcelsVisible: () => undefined,
    setPerspectiveViewMode: () => undefined,
    setPerspectiveVisibility: () => undefined,
    setPowerLayerVisible: () => undefined,
    setWaterVisible: () => undefined,
    visiblePerspectives: shallowRef({
      colocation: false,
      enterprise: false,
      hyperscale: false,
      "hyperscale-leased": false,
    }),
    waterVisible: shallowRef(false),
  };
}

describe("use app shell url state", () => {
  beforeEach(() => {
    route.query = {
      mapContextToken: "token",
      storyId: "initial",
    };
    replaceRequests.length = 0;
    routerReplaceMock.mockClear();
    applyMapContextTransferToAppShellMock.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it("ignores older self-authored route signatures when later writes supersede them", async () => {
    const scope = effectScope();
    const options = createOptions();
    const originalWarn = console.warn;
    console.warn = () => undefined;

    try {
      scope.run(() => {
        useAppShellUrlState(options);
      });
      await flushPromises();
      applyMapContextTransferToAppShellMock.mockReset();

      options.countyPowerStoryVisibility.value = {
        ...options.countyPowerStoryVisibility.value,
        storyId: "queue-pressure",
      };
      await waitForUrlSyncWindow();

      options.countyPowerStoryVisibility.value = {
        ...options.countyPowerStoryVisibility.value,
        storyId: "policy-watch",
      };
      await waitForUrlSyncWindow();

      expect(replaceRequests).toHaveLength(2);
      expect(replaceRequests[0]?.query).toMatchObject({
        mapContextToken: "token",
        storyId: "queue-pressure",
      });
      expect(replaceRequests[1]?.query).toMatchObject({
        mapContextToken: "token",
        storyId: "policy-watch",
      });

      route.query = replaceRequests[0]?.query ?? {};
      await flushPromises();
      expect(applyMapContextTransferToAppShellMock).not.toHaveBeenCalled();

      route.query = replaceRequests[1]?.query ?? {};
      await flushPromises();
      expect(applyMapContextTransferToAppShellMock).not.toHaveBeenCalled();

      route.query = {
        mapContextToken: "token",
        storyId: "external",
      };
      await flushPromises();

      expect(applyMapContextTransferToAppShellMock).toHaveBeenCalledTimes(1);
      expect(applyMapContextTransferToAppShellMock.mock.calls[0]?.[0]).toMatchObject({
        context: {
          query: {
            mapContextToken: "token",
            storyId: "external",
          },
        },
      });
    } finally {
      console.warn = originalWarn;
      scope.stop();
    }
  });
});
