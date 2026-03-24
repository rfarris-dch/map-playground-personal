import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Effect } from "effect";
import { FakeMap } from "../../support/fake-map";

mock.restore();

const fetchFacilitiesByBboxEffectMock = mock();
let stressGovernorChange: ((blocked: boolean) => void) | null = null;

mock.module("../../../src/features/facilities/api", () => ({
  fetchFacilitiesByBboxEffect: fetchFacilitiesByBboxEffectMock,
}));

mock.module("../../../src/features/parcels/parcels.service", () => ({
  createStressGovernor: (options: { readonly onChange?: (blocked: boolean) => void } = {}) => {
    stressGovernorChange = options.onChange ?? null;
    let blocked = false;

    return {
      destroy: () => undefined,
      isBlocked: () => blocked,
      setEnabled: () => undefined,
      trigger: (nextBlocked: boolean) => {
        blocked = nextBlocked;
        stressGovernorChange?.(nextBlocked);
      },
    };
  },
}));

const { mountFacilitiesLayer } = await import(
  "../../../src/features/facilities/facilities.layer.ts?facilities-layer-test"
);

function createMap(zoom: number): FakeMap {
  return new FakeMap({
    zoom,
    style: {
      version: 8,
      sources: {},
      layers: [],
    },
  });
}

async function flushRefresh(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

function createInteractionCoordinatorSnapshot() {
  return {
    bearing: 0,
    bearingDelta: 0,
    canonicalViewportKey: "viewport",
    eventType: "load" as const,
    interactionType: "initial" as const,
    pitch: 0,
    pitchDelta: 0,
    quantizedBbox: {
      west: -99,
      south: 39,
      east: -97,
      north: 41,
    },
    zoom: 5,
    zoomBucket: 5,
    zoomDelta: 0,
  };
}

describe("facilities layer", () => {
  beforeEach(() => {
    fetchFacilitiesByBboxEffectMock.mockReset();
    stressGovernorChange = null;
    fetchFacilitiesByBboxEffectMock.mockImplementation(() =>
      Effect.succeed({
        data: {
          type: "FeatureCollection",
          features: [],
          meta: {
            truncated: false,
          },
        },
        rawBody: "{}",
        requestId: "facilities-request",
      })
    );
  });

  afterAll(() => {
    mock.restore();
  });

  it("does not fetch while visible below the configured minimum zoom", async () => {
    const map = createMap(2.5);
    const statuses: unknown[] = [];
    const controller = mountFacilitiesLayer(map, {
      debounceMs: 0,
      initialViewMode: "dots",
      minZoom: 3,
      onStatus: (status) => {
        statuses.push(status);
      },
      perspective: "colocation",
    });

    try {
      map.emit("load");
      await flushRefresh();

      expect(fetchFacilitiesByBboxEffectMock).not.toHaveBeenCalled();
      expect(statuses.at(-1)).toMatchObject({
        state: "hidden",
        reason: "zoom",
        minZoom: 3,
      });
    } finally {
      controller.destroy();
    }
  });

  it("fetches once the viewport clears the minimum zoom", async () => {
    const map = createMap(5);
    const controller = mountFacilitiesLayer(map, {
      debounceMs: 0,
      initialViewMode: "dots",
      minZoom: 3,
      perspective: "colocation",
    });

    try {
      map.emit("load");
      await flushRefresh();

      expect(fetchFacilitiesByBboxEffectMock).toHaveBeenCalledTimes(1);
    } finally {
      controller.destroy();
    }
  });

  it("boots immediately when mounted after the interaction coordinator already has a snapshot", async () => {
    const map = createMap(5);
    const snapshot = createInteractionCoordinatorSnapshot();
    const controller = mountFacilitiesLayer(map, {
      debounceMs: 0,
      initialViewMode: "dots",
      interactionCoordinator: {
        destroy: () => undefined,
        getLastSnapshot: () => snapshot,
        subscribe: (listener, options = {}) => {
          if (options.emitCurrent) {
            listener(snapshot);
          }

          return () => undefined;
        },
      },
      minZoom: 3,
      perspective: "enterprise",
    });

    try {
      await flushRefresh();

      expect(fetchFacilitiesByBboxEffectMock).toHaveBeenCalledTimes(1);
    } finally {
      controller.destroy();
    }
  });

  it("does not clear visible facilities when the stress governor reports load", async () => {
    const map = createMap(5);
    const statuses: unknown[] = [];
    fetchFacilitiesByBboxEffectMock.mockImplementation(() =>
      Effect.succeed({
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: "facility-1",
              geometry: { type: "Point", coordinates: [-95.5, 29.5] },
              properties: {
                perspective: "colocation",
                facilityId: "facility-1",
                facilityName: "Facility One",
                providerId: "provider-1",
                providerName: "Provider One",
                countyFips: "48201",
                stateAbbrev: "TX",
                commissionedPowerMw: null,
                plannedPowerMw: null,
                underConstructionPowerMw: null,
                availablePowerMw: null,
                squareFootage: null,
                commissionedSemantic: "unknown",
                leaseOrOwn: null,
                statusLabel: null,
                address: null,
                city: null,
                state: null,
              },
            },
          ],
          meta: {
            truncated: false,
          },
        },
        rawBody: "{}",
        requestId: "facilities-request",
      })
    );
    const controller = mountFacilitiesLayer(map, {
      debounceMs: 0,
      initialViewMode: "dots",
      onStatus: (status) => {
        statuses.push(status);
      },
      perspective: "colocation",
    });

    try {
      map.emit("load");
      await flushRefresh();

      const sourceUpdateCount = map.sourceDataCalls.length;
      const lastSourceUpdate = map.sourceDataCalls.at(-1);
      expect(lastSourceUpdate).toMatchObject({
        sourceId: "facilities.colocation",
        data: {
          type: "FeatureCollection",
          features: [expect.objectContaining({ id: "facility-1" })],
        },
      });
      expect(typeof stressGovernorChange).toBe("function");

      stressGovernorChange?.(true);

      expect(map.sourceDataCalls.length).toBe(sourceUpdateCount);
      expect(map.sourceDataCalls.at(-1)).toEqual(lastSourceUpdate);
      expect(statuses.at(-1)).toMatchObject({
        state: "degraded",
        reason: "stress",
        requestId: "facilities-request",
        count: 1,
      });
    } finally {
      controller.destroy();
    }
  });
});
