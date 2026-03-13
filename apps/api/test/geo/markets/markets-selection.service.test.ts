import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const getSelectionAreaSqKmMock = mock<() => Promise<number>>();
const listMarketsBySelectionMock = mock<() => Promise<readonly unknown[]>>();

mock.module("../../../src/geo/markets/markets-selection.repo", () => ({
  getSelectionAreaSqKm: getSelectionAreaSqKmMock,
  listMarketsBySelection: listMarketsBySelectionMock,
}));

const { queryMarketsBySelection } = await import("@/geo/markets/markets-selection.service");

afterAll(() => {
  mock.restore();
});

describe("queryMarketsBySelection", () => {
  beforeEach(() => {
    getSelectionAreaSqKmMock.mockReset();
    listMarketsBySelectionMock.mockReset();
  });

  it("returns selection area even when no markets match", async () => {
    getSelectionAreaSqKmMock.mockResolvedValue(123.45);
    listMarketsBySelectionMock.mockResolvedValue([]);

    const result = await queryMarketsBySelection({
      geometryGeoJson: '{"type":"Polygon","coordinates":[]}',
      limit: 25,
      minimumSelectionOverlapPercent: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful empty market selection result");
    }

    expect(result.value.selectionAreaSqKm).toBe(123.45);
    expect(result.value.matchedMarkets).toEqual([]);
    expect(result.value.primaryMarket).toBeNull();
    expect(result.value.truncated).toBe(false);
    expect(result.value.warnings).toEqual([]);
  });

  it("marks market selections as truncated when the limit is exceeded", async () => {
    getSelectionAreaSqKmMock.mockResolvedValue(50);
    listMarketsBySelectionMock.mockResolvedValue([
      {
        absorption: null,
        country: "United States",
        intersection_area_sq_km: 10,
        latitude: 30.2672,
        longitude: -97.7431,
        market_area_sq_km: 100,
        market_id: "market-1",
        name: "Austin",
        region: "South",
        selection_area_sq_km: 50,
        state: "Texas",
        updated_at: "2026-03-07T00:00:00.000Z",
        vacancy: null,
      },
      {
        absorption: null,
        country: "United States",
        intersection_area_sq_km: 5,
        latitude: 29.7604,
        longitude: -95.3698,
        market_area_sq_km: 120,
        market_id: "market-2",
        name: "Houston",
        region: "South",
        selection_area_sq_km: 50,
        state: "Texas",
        updated_at: "2026-03-07T00:00:00.000Z",
        vacancy: null,
      },
    ]);

    const result = await queryMarketsBySelection({
      geometryGeoJson: '{"type":"Polygon","coordinates":[]}',
      limit: 1,
      minimumSelectionOverlapPercent: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful truncated market selection result");
    }

    expect(result.value.matchedMarkets).toHaveLength(1);
    expect(result.value.primaryMarket?.marketId).toBe("market-1");
    expect(result.value.truncated).toBe(true);
    expect(result.value.warnings).toContainEqual({
      code: "POSSIBLY_TRUNCATED",
      message:
        "Returned limit=1 markets. Increase the selection threshold or refine the AOI if you expected more.",
    });
  });
});
