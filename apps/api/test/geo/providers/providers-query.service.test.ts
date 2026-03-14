import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ProviderTableRow } from "@map-migration/http-contracts";

const countProvidersMock = mock<() => Promise<number>>();
const listProvidersPageMock =
  mock<
    (args: {
      limit: number;
      offset: number;
      sortBy: string;
      sortOrder: string;
    }) => Promise<unknown[]>
  >();
const mapProviderRowsToTableRowsMock =
  mock<(rows: readonly unknown[]) => readonly ProviderTableRow[]>();

mock.module("../../../src/geo/providers/providers.repo", () => ({
  countProviders: countProvidersMock,
  listProvidersPage: listProvidersPageMock,
}));

mock.module("../../../src/geo/providers/providers.mapper", () => ({
  mapProviderRowsToTableRows: mapProviderRowsToTableRowsMock,
}));

const { queryProvidersTable } = await import("@/geo/providers/providers-query.service");

afterAll(() => {
  mock.restore();
});

describe("queryProvidersTable", () => {
  beforeEach(() => {
    countProvidersMock.mockReset();
    listProvidersPageMock.mockReset();
    mapProviderRowsToTableRowsMock.mockReset();
  });

  it("returns mapped rows and total count on success", async () => {
    countProvidersMock.mockResolvedValue(1);
    listProvidersPageMock.mockResolvedValue([
      {
        provider_id: "p-1",
        name: "Provider One",
        category: "retail",
        country: "USA",
        state: "TX",
        listing_count: 10,
        supports_hyperscale: 1,
        supports_colocation: 1,
        updated_at: "2026-03-05T00:00:00.000Z",
      },
    ]);
    mapProviderRowsToTableRowsMock.mockReturnValue([
      {
        providerId: "p-1",
        name: "Provider One",
        category: "retail",
        country: "USA",
        state: "TX",
        listingCount: 10,
        supportsHyperscale: true,
        supportsColocation: true,
        updatedAt: "2026-03-05T00:00:00.000Z",
      },
    ]);

    const result = await queryProvidersTable({
      limit: 25,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful provider query");
    }
    expect(result.value.totalCount).toBe(1);
    expect(result.value.rows).toHaveLength(1);
  });

  it("returns query_failed when repository call fails", async () => {
    countProvidersMock.mockResolvedValue(1);
    listProvidersPageMock.mockRejectedValue(new Error("db down"));
    mapProviderRowsToTableRowsMock.mockReturnValue([]);

    const result = await queryProvidersTable({
      limit: 25,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed provider query");
    }
    expect(result.value.reason).toBe("query_failed");
  });

  it("returns mapping_failed when mapping throws", async () => {
    countProvidersMock.mockResolvedValue(1);
    listProvidersPageMock.mockResolvedValue([]);
    mapProviderRowsToTableRowsMock.mockImplementation(() => {
      throw new Error("map failed");
    });

    const result = await queryProvidersTable({
      limit: 25,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed provider mapping");
    }
    expect(result.value.reason).toBe("mapping_failed");
  });
});
