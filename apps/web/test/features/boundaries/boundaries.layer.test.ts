import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Effect } from "effect";
import { FakeMap } from "../../support/fake-map";

mock.restore();

const fetchBoundaryPowerEffectMock = mock();

mock.module("../../../src/features/boundaries/api", () => ({
  fetchBoundaryPowerEffect: fetchBoundaryPowerEffectMock,
}));

const { mountBoundaryLayer } = await import(
  "../../../src/features/boundaries/boundaries.layer.ts?boundaries-layer-test"
);

function createMap(): FakeMap {
  return new FakeMap({
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "boundary-labels",
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

describe("boundary layer", () => {
  beforeEach(() => {
    fetchBoundaryPowerEffectMock.mockReset();
    fetchBoundaryPowerEffectMock.mockImplementation(() =>
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
    const controller = mountBoundaryLayer(map, {
      layerId: "county",
    });

    try {
      map.emit("load");
      await flushAsyncWork();

      expect(fetchBoundaryPowerEffectMock).not.toHaveBeenCalled();
    } finally {
      controller.destroy();
    }
  });

  it("fetches the first time the layer becomes visible", async () => {
    const map = createMap();
    const controller = mountBoundaryLayer(map, {
      layerId: "county",
    });

    try {
      map.emit("load");
      controller.setVisible(true);
      await flushAsyncWork();

      expect(fetchBoundaryPowerEffectMock).toHaveBeenCalledTimes(1);
      expect(fetchBoundaryPowerEffectMock).toHaveBeenCalledWith("county");
    } finally {
      controller.destroy();
    }
  });
});
