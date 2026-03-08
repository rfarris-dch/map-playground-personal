import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const queryCountyScoresMock = mock();
const queryCountyScoresStatusMock = mock();
const queryMarketsBySelectionMock = mock();
const queryFacilitiesByPolygonMock = mock();
const isDatasetQueryAllowedMock = mock();
const listIntersectedCountyIdsMock = mock();
const getMarketBoundarySourceVersionMock = mock();
const getApiRuntimeConfigMock = mock();

mock.module("../../../src/geo/markets/markets-selection.service", () => ({
  queryMarketsBySelection: queryMarketsBySelectionMock,
}));

mock.module("../../../src/geo/facilities/route/facilities-route-query.service", () => ({
  queryFacilitiesByPolygon: queryFacilitiesByPolygonMock,
}));

mock.module("../../../src/geo/parcels/parcels.mapper", () => ({
  mapParcelRowsToFeatures: mock(),
}));

mock.module("../../../src/geo/parcels/parcels.repo", () => ({
  enrichParcelsByPolygon: mock(),
}));

mock.module("../../../src/geo/parcels/route/parcels-route-enrich.service", () => ({
  coerceCursor: (value: string | null | undefined) => value ?? null,
  paginateEnrichFeatures: mock(),
  resolvePageSize: mock(),
}));

mock.module("../../../src/geo/parcels/route/parcels-route-policy.service", () => ({
  bboxExceedsLimits: () => false,
  PARCELS_MAX_POLYGON_JSON_CHARS: 100_000,
  resolvePolygonGeometry: mock(),
}));

mock.module("../../../src/geo/parcels/route/parcels-route-meta.service", () => ({
  profileMetadataWarnings: () => [],
  readIngestionRunId: () => null,
}));

mock.module("../../../src/geo/analysis-summary/analysis-summary.repo", () => ({
  getMarketBoundarySourceVersion: getMarketBoundarySourceVersionMock,
  listIntersectedCountyIds: listIntersectedCountyIdsMock,
}));

mock.module("../../../src/http/runtime-config", () => ({
  getApiRuntimeConfig: getApiRuntimeConfigMock,
}));

mock.module("../../../src/http/spatial-analysis-policy.service", () => ({
  isDatasetQueryAllowed: isDatasetQueryAllowedMock,
}));

const { querySpatialAnalysisSummary } = await import(
  "@/geo/analysis-summary/analysis-summary.service"
);

afterAll(() => {
  mock.restore();
});

function createRequest() {
  return {
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [-97.8, 30.2],
          [-97.7, 30.2],
          [-97.7, 30.3],
          [-97.8, 30.2],
        ],
      ],
    },
    includeParcels: false,
    limitPerPerspective: 5000,
    minimumMarketSelectionOverlapPercent: 0,
    parcelPageSize: 20_000,
    perspectives: ["colocation", "hyperscale"] as const,
  };
}

function createFacilityFeature(id: string, perspective: "colocation" | "hyperscale") {
  return {
    type: "Feature" as const,
    id,
    geometry: {
      type: "Point" as const,
      coordinates: [-97.7431, 30.2672] as [number, number],
    },
    properties: {
      address: "123 Main St",
      availablePowerMw: 10,
      city: "Austin",
      commissionedPowerMw: 20,
      commissionedSemantic: "operational" as const,
      countyFips: "48453",
      facilityId: id,
      facilityName: `Facility ${id}`,
      leaseOrOwn: "own" as const,
      perspective,
      plannedPowerMw: 5,
      providerId: "provider-1",
      providerName: "Provider One",
      squareFootage: 1000,
      state: "Texas",
      stateAbbrev: "TX",
      statusLabel: "Operational",
      underConstructionPowerMw: 0,
    },
  };
}

describe("querySpatialAnalysisSummary", () => {
  beforeEach(() => {
    queryCountyScoresMock.mockReset();
    queryCountyScoresStatusMock.mockReset();
    queryMarketsBySelectionMock.mockReset();
    queryFacilitiesByPolygonMock.mockReset();
    isDatasetQueryAllowedMock.mockReset();
    listIntersectedCountyIdsMock.mockReset();
    getMarketBoundarySourceVersionMock.mockReset();
    getApiRuntimeConfigMock.mockReset();

    isDatasetQueryAllowedMock.mockReturnValue(true);
    queryFacilitiesByPolygonMock
      .mockResolvedValueOnce({
        ok: true,
        value: {
          features: [createFacilityFeature("colo-1", "colocation")],
          truncated: false,
          warnings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          features: [],
          truncated: false,
          warnings: [],
        },
      });
    listIntersectedCountyIdsMock.mockResolvedValue([
      {
        county_fips: "48453",
        selection_area_sq_km: 123.45,
      },
    ]);
    getApiRuntimeConfigMock.mockReturnValue({
      dataVersion: "dev",
      facilitiesSourceMode: "postgis",
      parcelsSourceMode: "postgis",
    });
  });

  it("returns partial results with warnings when market boundaries and county scores are unavailable", async () => {
    queryMarketsBySelectionMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error('relation "market_current.market_boundaries" does not exist'),
        reason: "boundary_source_unavailable",
      },
    });
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: true,
      value: {
        availableFeatureFamilies: ["facilities", "hyperscale"],
        dataVersion: "2026-03-07",
        datasetAvailable: true,
        featureCoverage: {
          enterprise: false,
          facilities: true,
          fiber: false,
          hazards: false,
          hyperscale: true,
          policy: false,
          terrain: false,
          transmission: false,
          utilityTerritory: false,
          waterStress: false,
        },
        formulaVersion: "county-scores-v1",
        inputDataVersion: "inputs-v1",
        methodologyId: "county-method-v1",
        missingFeatureFamilies: ["enterprise"],
        publicationRunId: "county-run-1",
        publishedAt: "2026-03-07T00:00:00.000Z",
        rowCount: 1,
        scoredCountyCount: 1,
        sourceCountyCount: 1,
        waterCoverageCount: 0,
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("county scores publication is unavailable"),
        reason: "source_unavailable",
      },
    });
    getMarketBoundarySourceVersionMock.mockRejectedValue(
      new Error('relation "market_current.market_boundaries" does not exist')
    );

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: createRequest(),
      },
      {
        queryCountyScores: queryCountyScoresMock,
        queryCountyScoresStatus: queryCountyScoresStatusMock,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful summary query");
    }

    expect(result.value.summary.totalCount).toBe(1);
    expect(result.value.coverage.markets.boundarySourceAvailable).toBe(false);
    expect(result.value.coverage.markets.unavailableReason).toBe(
      "Market boundary dataset is unavailable."
    );
    expect(result.value.countyIntelligence.status?.publicationRunId).toBe("county-run-1");
    expect(result.value.countyIntelligence.scores).toBeNull();
    expect(result.value.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "COUNTY_INTELLIGENCE_UNAVAILABLE",
        "MARKET_BOUNDARY_SOURCE_UNAVAILABLE",
      ])
    );
  });

  it("skips facility queries when no facility perspectives are requested", async () => {
    queryMarketsBySelectionMock.mockResolvedValue({
      ok: true,
      value: {
        matchedMarkets: [],
        primaryMarket: null,
        selectionAreaSqKm: 123.45,
      },
    });
    queryCountyScoresStatusMock.mockResolvedValue({
      ok: false,
      value: {
        error: new Error("status unavailable"),
        reason: "source_unavailable",
      },
    });
    queryCountyScoresMock.mockResolvedValue({
      ok: true,
      value: {
        dataVersion: "2026-03-07",
        missingCountyIds: [],
        requestedCountyIds: ["48453"],
        rows: [],
        unavailableCountyIds: [],
      },
    });
    getMarketBoundarySourceVersionMock.mockResolvedValue("derived-market-boundaries-v1");

    const result = await querySpatialAnalysisSummary(
      {
        expectedParcelIngestionRunId: null,
        request: {
          ...createRequest(),
          perspectives: [],
        },
      },
      {
        queryCountyScores: queryCountyScoresMock,
        queryCountyScoresStatus: queryCountyScoresStatusMock,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful empty-perspective summary");
    }

    expect(queryFacilitiesByPolygonMock).not.toHaveBeenCalled();
    expect(result.value.summary.totalCount).toBe(0);
    expect(result.value.provenance.facilities.countsByPerspective).toEqual({
      colocation: 0,
      hyperscale: 0,
    });
  });
});
