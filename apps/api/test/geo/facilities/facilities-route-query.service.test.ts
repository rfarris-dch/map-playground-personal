import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { FacilitiesBboxRow } from "@/geo/facilities/facilities.repo";

const listFacilitiesByBboxMock =
  mock<
    (args: {
      east: number;
      limit: number;
      north: number;
      perspective: string;
      south: number;
      west: number;
    }) => Promise<unknown[]>
  >();
const listFacilitiesByPolygonMock =
  mock<
    (args: { geometryGeoJson: string; limit: number; perspective: string }) => Promise<unknown[]>
  >();
const countFacilitiesTableRowsMock = mock<(perspective: string) => Promise<number>>();
const listFacilitiesTableRowsMock =
  mock<
    (args: {
      perspective: string;
      limit: number;
      offset: number;
      sortBy: string;
      sortOrder: string;
    }) => Promise<unknown[]>
  >();
const getFacilityByIdMock =
  mock<(facilityId: string, perspective: string) => Promise<unknown | null>>();

mock.module("../../../src/geo/facilities/facilities.repo", () => ({
  countFacilitiesTableRows: countFacilitiesTableRowsMock,
  getFacilityById: getFacilityByIdMock,
  listFacilitiesByBbox: listFacilitiesByBboxMock,
  listFacilitiesByPolygon: listFacilitiesByPolygonMock,
  listFacilitiesTableRows: listFacilitiesTableRowsMock,
}));

const { queryFacilitiesByBbox, queryFacilityDetail } = await import(
  "@/geo/facilities/route/facilities-route-query.service"
);

function buildBboxRow(id: string): FacilitiesBboxRow {
  return {
    facility_id: id,
    facility_name: `Facility ${id}`,
    provider_id: "provider-1",
    provider_name: "Provider One",
    county_fips: "48453",
    commissioned_power_mw: "10",
    commissioned_semantic: "operational",
    lease_or_own: "own",
    geom_json: {
      type: "Point",
      coordinates: [-97.7431, 30.2672],
    },
  };
}

describe("facilities route query service", () => {
  beforeEach(() => {
    listFacilitiesByBboxMock.mockReset();
    listFacilitiesByPolygonMock.mockReset();
    countFacilitiesTableRowsMock.mockReset();
    listFacilitiesTableRowsMock.mockReset();
    getFacilityByIdMock.mockReset();
  });

  it("returns truncated bbox result with warnings when row count exceeds limit", async () => {
    listFacilitiesByBboxMock.mockResolvedValue([
      buildBboxRow("1"),
      buildBboxRow("2"),
      buildBboxRow("3"),
    ]);

    const result = await queryFacilitiesByBbox({
      bbox: {
        west: -98,
        south: 30,
        east: -97,
        north: 31,
      },
      limit: 2,
      perspective: "colocation",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful bbox result");
    }
    expect(result.value.features).toHaveLength(2);
    expect(result.value.truncated).toBe(true);
    expect(result.value.warnings).toHaveLength(1);
  });

  it("returns query_failed when bbox query throws", async () => {
    listFacilitiesByBboxMock.mockRejectedValue(new Error("db error"));

    const result = await queryFacilitiesByBbox({
      bbox: {
        west: -98,
        south: 30,
        east: -97,
        north: 31,
      },
      limit: 2,
      perspective: "colocation",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected query failure");
    }
    expect(result.value.reason).toBe("query_failed");
  });

  it("returns not_found when detail row does not exist", async () => {
    getFacilityByIdMock.mockResolvedValue(null);

    const result = await queryFacilityDetail({
      facilityId: "missing-id",
      perspective: "colocation",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected not found detail result");
    }
    expect(result.value.reason).toBe("not_found");
  });
});
