import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { FacilitiesDatasetSqlTables } from "@map-migration/geo-sql";
import type { FacilitiesBboxRow } from "@/geo/facilities/facilities.repo";

const DATASET_TABLES: FacilitiesDatasetSqlTables = {
  colocationFastTable: '"serve"."facility_site_fast__test"',
  hyperscaleFastTable: '"serve"."hyperscale_site_fast__test"',
};

const listFacilitiesByBboxMock =
  mock<
    (args: {
      east: number;
      limit: number;
      north: number;
      perspective: string;
      south: number;
      tables: FacilitiesDatasetSqlTables;
      west: number;
    }) => Promise<unknown[]>
  >();
const listFacilitiesByPolygonMock =
  mock<
    (args: {
      geometryGeoJson: string;
      limit: number;
      perspective: string;
      tables: FacilitiesDatasetSqlTables;
    }) => Promise<unknown[]>
  >();
const countFacilitiesTableRowsMock =
  mock<(perspective: string, tables: FacilitiesDatasetSqlTables) => Promise<number>>();
const listFacilitiesTableRowsMock =
  mock<
    (args: {
      perspective: string;
      limit: number;
      offset: number;
      sortBy: string;
      sortOrder: string;
      tables: FacilitiesDatasetSqlTables;
    }) => Promise<unknown[]>
  >();
const getFacilityByIdMock =
  mock<
    (
      facilityId: string,
      perspective: string,
      tables: FacilitiesDatasetSqlTables
    ) => Promise<unknown | null>
  >();

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

afterAll(() => {
  mock.restore();
});

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
      tables: DATASET_TABLES,
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
      tables: DATASET_TABLES,
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
      tables: DATASET_TABLES,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected not found detail result");
    }
    expect(result.value.reason).toBe("not_found");
  });
});
