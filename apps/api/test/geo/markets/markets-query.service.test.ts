import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { MarketTableRow } from "@map-migration/http-contracts";

const countMarketsMock = mock<() => Promise<number>>();
const listMarketsPageMock =
  mock<
    (args: {
      limit: number;
      offset: number;
      sortBy: string;
      sortOrder: string;
    }) => Promise<unknown[]>
  >();
const mapMarketRowsToTableRowsMock =
  mock<(rows: readonly unknown[]) => readonly MarketTableRow[]>();

mock.module("../../../src/geo/markets/markets.repo", () => ({
  countMarkets: countMarketsMock,
  listMarketsPage: listMarketsPageMock,
}));

mock.module("../../../src/geo/markets/markets.mapper", () => ({
  mapMarketRowsToTableRows: mapMarketRowsToTableRowsMock,
}));

const { queryMarketsTable } = await import("@/geo/markets/markets-query.service");

afterAll(() => {
  mock.restore();
});

describe("queryMarketsTable", () => {
  beforeEach(() => {
    countMarketsMock.mockReset();
    listMarketsPageMock.mockReset();
    mapMarketRowsToTableRowsMock.mockReset();
  });

  it("returns mapped rows and total count on success", async () => {
    countMarketsMock.mockResolvedValue(2);
    listMarketsPageMock.mockResolvedValue([
      {
        market_id: "m-1",
        name: "Austin",
        region: "South",
        country: "USA",
        state: "TX",
        absorption: 1.5,
        vacancy: 2.5,
        updated_at: "2026-03-05T00:00:00.000Z",
      },
    ]);
    mapMarketRowsToTableRowsMock.mockReturnValue([
      {
        marketId: "m-1",
        name: "Austin",
        region: "South",
        country: "USA",
        state: "TX",
        absorption: 1.5,
        vacancy: 2.5,
        updatedAt: "2026-03-05T00:00:00.000Z",
      },
    ]);

    const result = await queryMarketsTable({
      limit: 50,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful query result");
    }
    expect(result.value.totalCount).toBe(2);
    expect(result.value.rows).toHaveLength(1);
  });

  it("returns query_failed when repository call fails", async () => {
    countMarketsMock.mockRejectedValue(new Error("db down"));
    listMarketsPageMock.mockResolvedValue([]);
    mapMarketRowsToTableRowsMock.mockReturnValue([]);

    const result = await queryMarketsTable({
      limit: 50,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed query result");
    }
    expect(result.value.reason).toBe("query_failed");
  });

  it("returns mapping_failed when mapping throws", async () => {
    countMarketsMock.mockResolvedValue(1);
    listMarketsPageMock.mockResolvedValue([]);
    mapMarketRowsToTableRowsMock.mockImplementation(() => {
      throw new Error("mapping failure");
    });

    const result = await queryMarketsTable({
      limit: 50,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed mapping result");
    }
    expect(result.value.reason).toBe("mapping_failed");
  });
});
