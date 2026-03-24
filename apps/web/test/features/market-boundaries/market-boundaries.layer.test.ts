import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Effect } from "effect";
import { FakeMap } from "../../support/fake-map";

mock.restore();

const fetchMarketBoundariesEffectMock = mock();

mock.module("../../../src/features/market-boundaries/api", () => ({
  fetchMarketBoundariesEffect: fetchMarketBoundariesEffectMock,
}));

const { mountMarketBoundaryLayer } = await import(
  "../../../src/features/market-boundaries/market-boundaries.layer.ts?market-boundaries-layer-test"
);

function createMap(): FakeMap {
  return new FakeMap({
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "market-labels",
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

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("market boundary layer", () => {
  beforeEach(() => {
    fetchMarketBoundariesEffectMock.mockReset();
    fetchMarketBoundariesEffectMock.mockImplementation(() =>
      Effect.succeed({
        data: {
          type: "FeatureCollection",
          features: [],
        },
      })
    );
  });

  afterAll(() => {
    mock.restore();
  });

  it("stays cold while hidden during load bootstrap", async () => {
    const map = createMap();
    const controller = mountMarketBoundaryLayer(map, {
      layerId: "market",
    });

    try {
      map.emit("load");
      await flushAsyncWork();

      expect(fetchMarketBoundariesEffectMock).not.toHaveBeenCalled();
    } finally {
      controller.destroy();
    }
  });

  it("fetches the first time the layer becomes visible", async () => {
    const map = createMap();
    const controller = mountMarketBoundaryLayer(map, {
      layerId: "market",
    });

    try {
      map.emit("load");
      controller.setVisible(true);
      await flushAsyncWork();

      expect(fetchMarketBoundariesEffectMock).toHaveBeenCalledTimes(1);
      expect(fetchMarketBoundariesEffectMock).toHaveBeenCalledWith("market");
    } finally {
      controller.destroy();
    }
  });
});
